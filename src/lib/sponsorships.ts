import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import { nyToday } from "@/lib/thursdays";

const sponsorshipNames = {
  orderBy: { createdAt: "asc" },
  include: { members: { include: { member: { select: { id: true, name: true } } } } },
} as const;

/** The sponsorship amount setting, in cents ($30 by default). */
export async function getSponsorshipAmountCents() {
  const settings = await db.appSettings.findUnique({
    where: { id: 1 },
    select: { sponsorshipAmountCents: true },
  });
  return settings?.sponsorshipAmountCents ?? 3000;
}

/**
 * This Thursday's menu for the Home *Menu* card: the first Thursday from today on (New York
 * time), which Home keeps showing until midnight after it.
 */
export async function getHomeMenu(now = new Date()) {
  await syncThursdays(now);
  const [event, amountCents] = await Promise.all([
    db.breakfastEvent.findFirst({
      where: { date: { gte: nyToday(now) } },
      orderBy: { date: "asc" },
      include: {
        menuItems: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: { sponsorships: sponsorshipNames },
        },
      },
    }),
    getSponsorshipAmountCents(),
  ]);
  if (!event) return null;
  const item = event.menuItems[0];
  return {
    event,
    amountCents,
    item: item && {
      name: item.name,
      sponsorships: item.sponsorships.map((s) => ({
        ...s,
        members: s.members.map((m) => m.member),
      })),
    },
  };
}

/**
 * The member's sponsorships for Home: every upcoming one, plus past ones still unpaid (so they
 * remember to pay). Soonest Thursday first.
 */
export async function listMySponsorships(memberId: string, now = new Date()) {
  const today = nyToday(now);
  const rows = await db.sponsorship.findMany({
    where: {
      members: { some: { memberId } },
      OR: [{ paid: false }, { menuItem: { event: { date: { gte: today } } } }],
    },
    include: {
      menuItem: { select: { name: true, event: { select: { date: true } } } },
      members: { include: { member: { select: { id: true, name: true } } } },
    },
  });
  return rows
    .map((s) => ({
      id: s.id,
      itemName: s.menuItem.name,
      eventDate: s.menuItem.event.date,
      teamName: s.teamName,
      sponsorName: s.sponsorName,
      members: s.members.map((m) => m.member),
      paid: s.paid,
      amountCents: s.amountCents,
    }))
    .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
}

/** Coworkers to pick from for *Me + someone* (every member but you), by name. */
export async function listCoworkers(memberId: string) {
  return db.member.findMany({
    where: { id: { not: memberId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
