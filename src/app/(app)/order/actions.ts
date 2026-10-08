"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/dal";
import { canEditOwnOrder, canPlaceOrder } from "@/lib/ordering";

// A member's own order (docs/business-rules.md → Ordering). Walk-in = no Yes RSVP.

export type OrderState = { error?: string };

const orderInput = z.object({
  eventId: z.string().min(1).max(64),
  notes: z.string().trim().max(300).optional(),
  // One entry per chosen item: { menuItemId, options: { [group]: label } }
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1).max(64),
        options: z.record(z.string().max(40), z.string().max(40)).default({}),
      }),
    )
    .min(1, "Pick something to order.")
    .max(20),
});

function refresh(eventId: string) {
  revalidatePath("/");
  revalidatePath(`/order/${eventId}`);
  revalidatePath(`/kitchen/${eventId}`);
}

export async function placeOrder(_prev: OrderState, formData: FormData): Promise<OrderState> {
  const member = await getCurrentMember();
  let raw: unknown;
  try {
    raw = { ...Object.fromEntries(formData), items: JSON.parse(String(formData.get("items"))) };
  } catch {
    return { error: "Pick something to order." };
  }
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your order." };
  const { eventId, notes, items } = parsed.data;

  const [event, menu, existing, yes] = await Promise.all([
    db.breakfastEvent.findUnique({ where: { id: eventId } }),
    db.menuItem.findMany({
      where: { eventId, orderable: true },
      include: { options: true },
    }),
    db.order.findUnique({ where: { eventId_memberId: { eventId, memberId: member.id } } }),
    db.rsvp.findFirst({ where: { eventId, memberId: member.id, answer: "YES" } }),
  ]);
  if (!event || !canPlaceOrder(existing, event)) {
    return {
      error:
        existing && existing.status !== "PLACED" && existing.status !== "CANCELLED"
          ? "Your order is already cooking, so it can't be changed."
          : "Ordering isn't open right now.",
    };
  }

  const lines: {
    menuItemId: string;
    itemName: string;
    quantity: number;
    selectedOptions: { group: string; label: string }[];
  }[] = [];
  for (const choice of items) {
    const item = menu.find((m) => m.id === choice.menuItemId);
    if (!item) return { error: "That item isn't on this Thursday's menu." };
    const groups = [...new Set(item.options.map((o) => o.group))];
    const selectedOptions: { group: string; label: string }[] = [];
    for (const group of groups) {
      const label = choice.options[group];
      if (!label) return { error: `Choose a ${group.toLowerCase()} for ${item.name}.` };
      if (!item.options.some((o) => o.group === group && o.label === label)) {
        return { error: `That ${group.toLowerCase()} isn't available for ${item.name}.` };
      }
      selectedOptions.push({ group, label });
    }
    lines.push({ menuItemId: item.id, itemName: item.name, quantity: 1, selectedOptions });
  }

  const data = {
    isWalkIn: !yes,
    status: "PLACED" as const,
    notes: notes || null,
    statusAt: new Date(),
  };
  await db.$transaction(async (tx) => {
    // Guard: only replace an order that is still Placed (or was cancelled).
    const order = existing
      ? await tx.order.update({
          where: { id: existing.id, status: { in: ["PLACED", "CANCELLED"] } },
          data: existing.status === "CANCELLED" ? { ...data, placedAt: new Date() } : data,
        })
      : await tx.order.create({ data: { eventId, memberId: member.id, ...data } });
    await tx.orderLine.deleteMany({ where: { orderId: order.id } });
    await tx.orderLine.createMany({ data: lines.map((l) => ({ orderId: order.id, ...l })) });
  });
  refresh(eventId);
  // After ordering, members watch their order on the kitchen queue (open-questions #48).
  redirect(`/kitchen/${eventId}`);
}

export async function cancelMyOrder(formData: FormData) {
  const member = await getCurrentMember();
  const eventId = z.string().min(1).max(64).parse(formData.get("eventId"));
  const [event, order] = await Promise.all([
    db.breakfastEvent.findUnique({ where: { id: eventId } }),
    db.order.findUnique({ where: { eventId_memberId: { eventId, memberId: member.id } } }),
  ]);
  if (!event || !order || !canEditOwnOrder(order, event)) return;
  await db.order.updateMany({
    where: { id: order.id, status: "PLACED" },
    data: { status: "CANCELLED", statusAt: new Date() },
  });
  refresh(eventId);
  redirect("/");
}
