"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentMember, requireOrganizer } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  FULLY_SPONSORED,
  canEditMenu,
  canRemoveSponsorship,
  firstIssue,
  menuItemInput,
  nextSponsorsNeeded,
  sponsorBlockReason,
  sponsorByNameInput,
  sponsorInput,
  sponsorsNeededInput,
  sponsorshipIdInput,
} from "@/lib/sponsorship-rules";
import { nyToday } from "@/lib/thursdays";

// Menu & sponsorship mutations (M4). Every action re-checks who is signed in and the Thursday's
// current state; anything that adds a sponsorship or changes sponsors needed locks the Thursday's
// row first, so two people can't both take the last sponsor spot.

export type ActionState = { ok?: boolean; error?: string };

function refresh() {
  revalidatePath("/schedule");
  revalidatePath("/");
  revalidatePath("/admin/events");
  revalidatePath("/admin/payments");
}

const lockedEventQuery = {
  menuItems: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    include: {
      sponsorships: { include: { members: { select: { memberId: true } } } },
      _count: { select: { orderLines: true } },
    },
  },
} as const;

type LockedEvent = Prisma.BreakfastEventGetPayload<{ include: typeof lockedEventQuery }>;

/** Runs `fn` in a transaction holding a row lock on the Thursday. */
function withLockedEvent<T>(
  eventId: string,
  fn: (tx: Prisma.TransactionClient, event: LockedEvent) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "BreakfastEvent" WHERE "id" = ${eventId} FOR UPDATE`;
    const event = await tx.breakfastEvent.findUnique({
      where: { id: eventId },
      include: lockedEventQuery,
    });
    if (!event) throw new Error("That Thursday no longer exists.");
    return fn(tx, event);
  });
}

async function sponsorshipAmountCents(tx: Prisma.TransactionClient) {
  const settings = await tx.appSettings.findUnique({ where: { id: 1 } });
  return settings?.sponsorshipAmountCents ?? 3000;
}

const blockReason = (event: LockedEvent) =>
  sponsorBlockReason(
    {
      event,
      hasMenuItem: event.menuItems.length > 0,
      sponsorshipCount: event.menuItems[0]?.sponsorships.length ?? 0,
    },
    nyToday(),
  );

/** *Sponsor this*: Just me, Me + someone, or A team. */
export async function sponsorThis(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const member = await getCurrentMember();
  const parsed = sponsorInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const input = parsed.data;

  let partner: { id: string; name: string } | null = null;
  if (input.mode === "two") {
    if (input.partnerId === member.id) return { error: "Pick someone other than yourself." };
    partner = await db.member.findUnique({
      where: { id: input.partnerId },
      select: { id: true, name: true },
    });
    if (!partner) return { error: "Pick a coworker from the list." };
  }

  const error = await withLockedEvent(input.eventId, async (tx, event) => {
    const reason = blockReason(event);
    if (reason) return reason;
    const item = event.menuItems[0];
    const onIt = new Set(item.sponsorships.flatMap((s) => s.members.map((m) => m.memberId)));
    if (onIt.has(member.id)) return `You're already sponsoring ${item.name}.`;
    if (partner && onIt.has(partner.id))
      return `${partner.name} is already sponsoring ${item.name}.`;

    const memberIds = partner ? [member.id, partner.id] : [member.id];
    await tx.sponsorship.create({
      data: {
        menuItemId: item.id,
        teamName: input.mode === "team" ? input.teamName : null,
        amountCents: await sponsorshipAmountCents(tx),
        createdById: member.id,
        members: { create: memberIds.map((memberId) => ({ memberId })) },
      },
    });
    return null;
  });
  if (error) return { error };
  refresh();
  return { ok: true };
}

/** Removes a sponsorship: the organizer any, a member their own while unpaid and upcoming. */
export async function removeSponsorship(formData: FormData) {
  const member = await getCurrentMember();
  const { sponsorshipId } = sponsorshipIdInput.parse(Object.fromEntries(formData));
  const s = await db.sponsorship.findUnique({
    where: { id: sponsorshipId },
    select: {
      paid: true,
      members: { select: { memberId: true } },
      menuItem: { select: { event: { select: { date: true } } } },
    },
  });
  if (!s) return; // already removed
  const removable = canRemoveSponsorship(
    { paid: s.paid, memberIds: s.members.map((m) => m.memberId), eventDate: s.menuItem.event.date },
    member,
    nyToday(),
  );
  if (!removable) throw new Error("Only the organizer can change that sponsorship now.");
  await db.sponsorship.delete({ where: { id: sponsorshipId } });
  refresh();
}

// ---- Organizer only ----

/** Creates, renames or (when emptied) removes a Thursday's menu item. Renaming keeps its sponsorships. */
export async function saveMenuItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrganizer();
  const parsed = menuItemInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { eventId, name } = parsed.data;

  const error = await withLockedEvent(eventId, async (tx, event) => {
    if (!canEditMenu(event, nyToday())) return "That Thursday's menu can't be changed now.";
    const item = event.menuItems[0];
    if (!name) {
      if (!item) return null;
      if (item.sponsorships.length || item._count.orderLines)
        return "This item has sponsors or orders, so it can't be removed. Rename it instead.";
      await tx.menuItem.delete({ where: { id: item.id } });
    } else if (!item) {
      await tx.menuItem.create({ data: { eventId, name } });
    } else if (item.name !== name) {
      await tx.menuItem.update({ where: { id: item.id }, data: { name } });
    }
    return null;
  });
  if (error) return { error };
  refresh();
  return { ok: true };
}

/** − / + on sponsors needed (min 1, and never below the sponsorships already on the item). */
export async function changeSponsorsNeeded(formData: FormData) {
  await requireOrganizer();
  const { eventId, delta } = sponsorsNeededInput.parse(Object.fromEntries(formData));
  await withLockedEvent(eventId, async (tx, event) => {
    if (!canEditMenu(event, nyToday())) throw new Error("That Thursday can't be changed now.");
    const count = event.menuItems[0]?.sponsorships.length ?? 0;
    const sponsorsNeeded = nextSponsorsNeeded(event.sponsorsNeeded, delta, count);
    if (sponsorsNeeded !== event.sponsorsNeeded)
      await tx.breakfastEvent.update({ where: { id: eventId }, data: { sponsorsNeeded } });
  });
  refresh();
}

/** Adds a sponsor by typing a name (someone who isn't a member). */
export async function addSponsorByName(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizer = await requireOrganizer();
  const parsed = sponsorByNameInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { eventId, sponsorName } = parsed.data;

  const error = await withLockedEvent(eventId, async (tx, event) => {
    const reason = blockReason(event);
    if (reason)
      return reason === FULLY_SPONSORED
        ? "Already fully sponsored. Press + to need more sponsors first."
        : reason;
    await tx.sponsorship.create({
      data: {
        menuItemId: event.menuItems[0].id,
        sponsorName,
        amountCents: await sponsorshipAmountCents(tx),
        createdById: organizer.id,
      },
    });
    return null;
  });
  if (error) return { error };
  refresh();
  return { ok: true };
}
