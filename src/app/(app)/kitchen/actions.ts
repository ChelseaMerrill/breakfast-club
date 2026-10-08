"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/dal";
import {
  canCancelFromBoard,
  canCloseOrdering,
  canOpenOrdering,
  nextStatus,
  previousStatus,
} from "@/lib/ordering";
import { notifyOrderReady } from "@/lib/ready-notify";
import { nyToday } from "@/lib/thursdays";

// Organizer-only kitchen actions (docs/business-rules.md → Ordering, Walk-ins & guests).
// Every action re-checks the session and current state; order moves are guarded on the
// status the organizer saw, so a double tap can't skip a column.

export type KitchenState = { ok?: boolean; error?: string };

const id = z.string().min(1).max(64);

function refresh(eventId?: string) {
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/admin/events");
  if (eventId) {
    revalidatePath(`/kitchen/${eventId}`);
    revalidatePath(`/order/${eventId}`);
  }
}

export async function openOrdering(formData: FormData) {
  await requireOrganizer();
  const eventId = id.parse(formData.get("eventId"));
  const event = await db.breakfastEvent.findUniqueOrThrow({ where: { id: eventId } });
  if (!canOpenOrdering(event, nyToday()))
    throw new Error("Ordering can't be opened for that Thursday.");
  await db.breakfastEvent.updateMany({
    where: { id: eventId, status: event.status },
    data: { status: "ORDERING_OPEN", orderingOpenedAt: new Date(), orderingAutoClosed: false },
  });
  refresh(eventId);
}

export async function closeOrdering(formData: FormData) {
  await requireOrganizer();
  const eventId = id.parse(formData.get("eventId"));
  const event = await db.breakfastEvent.findUniqueOrThrow({ where: { id: eventId } });
  if (!canCloseOrdering(event)) return; // already closed
  await db.breakfastEvent.updateMany({
    where: { id: eventId, status: "ORDERING_OPEN" },
    data: { status: "ORDERING_CLOSED", orderingClosedAt: new Date() },
  });
  refresh(eventId);
}

const moveInput = z.object({
  orderId: id,
  from: z.enum(["PLACED", "COOKING", "READY", "PICKED_UP"]),
  move: z.enum(["advance", "back", "cancel"]),
});

/** Tap to advance, ← Back, or Cancel (Placed only). */
export async function moveOrder(formData: FormData) {
  await requireOrganizer();
  const { orderId, from, move } = moveInput.parse(Object.fromEntries(formData));
  const to =
    move === "advance"
      ? nextStatus(from)
      : move === "back"
        ? previousStatus(from)
        : canCancelFromBoard(from)
          ? "CANCELLED"
          : null;
  if (!to) return;
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { eventId: true, event: { select: { status: true } } },
  });
  if (!order || order.event.status === "COMPLETED") return;
  // Only moves if it's still where the organizer saw it.
  const moved = await db.order.updateMany({
    where: { id: orderId, status: from },
    data: { status: to, statusAt: new Date() },
  });
  refresh(order.eventId);
  // Cooking → Ready: DM the member once the tap has responded, so Slack never slows the board.
  if (moved.count === 1 && move === "advance" && to === "READY") {
    after(() => notifyOrderReady(orderId));
  }
}

const walkInInput = z.object({
  eventId: id,
  name: z.string().trim().min(1, "Type a name.").max(80),
  menuItemId: id,
});

/**
 * + Walk-in (decision #37): a name matching exactly one member makes a member order;
 * anything else becomes a guest (guests may have several orders).
 */
export async function addWalkIn(_prev: KitchenState, formData: FormData): Promise<KitchenState> {
  const organizer = await requireOrganizer();
  const parsed = walkInInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the walk-in." };
  const { eventId, name, menuItemId } = parsed.data;

  const [event, item, matches] = await Promise.all([
    db.breakfastEvent.findUnique({ where: { id: eventId } }),
    db.menuItem.findFirst({ where: { id: menuItemId, eventId, orderable: true } }),
    db.member.findMany({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true },
    }),
  ]);
  if (!event || !(event.status === "ORDERING_OPEN" || event.status === "ORDERING_CLOSED")) {
    return { error: "Open ordering first." };
  }
  if (!item) return { error: "Pick an item from this Thursday's menu." };
  if (matches.length > 1) return { error: `More than one member is called ${name}.` };

  const member = matches[0] ?? null;
  const line = { menuItemId: item.id, itemName: item.name, quantity: 1, selectedOptions: [] };

  if (member) {
    const existing = await db.order.findUnique({
      where: { eventId_memberId: { eventId, memberId: member.id } },
    });
    if (existing && existing.status !== "CANCELLED") {
      return { error: `${member.name} already has an order.` };
    }
    const yes = await db.rsvp.findFirst({
      where: { eventId, memberId: member.id, answer: "YES" },
    });
    const data = {
      isWalkIn: !yes,
      enteredById: organizer.id,
      status: "PLACED" as const,
      notes: null,
      placedAt: new Date(),
      statusAt: new Date(),
    };
    await db.$transaction(async (tx) => {
      const order = existing
        ? await tx.order.update({ where: { id: existing.id }, data })
        : await tx.order.create({ data: { eventId, memberId: member.id, ...data } });
      await tx.orderLine.deleteMany({ where: { orderId: order.id } });
      await tx.orderLine.create({ data: { orderId: order.id, ...line } });
    });
  } else {
    await db.order.create({
      data: {
        eventId,
        guestName: name,
        isWalkIn: true,
        enteredById: organizer.id,
        lines: { create: line },
      },
    });
  }
  refresh(eventId);
  return { ok: true };
}

/** Delete an order that has been picked up (organizer only; open-questions #46). */
export async function deleteOrder(formData: FormData) {
  await requireOrganizer();
  const orderId = id.parse(formData.get("orderId"));
  const order = await db.order.findUnique({ where: { id: orderId }, select: { eventId: true } });
  if (!order) return; // already gone
  // Only while it's still Picked up; lines cascade with the order.
  await db.order.deleteMany({ where: { id: orderId, status: "PICKED_UP" } });
  refresh(order.eventId);
}
