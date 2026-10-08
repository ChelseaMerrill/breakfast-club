import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import {
  BOARD,
  canOpenOrdering,
  isOrderingOpen,
  itemTotals,
  orderSummary,
  orderTag,
} from "@/lib/ordering";
import { headcount } from "@/lib/rsvp";
import { nyToday, TIME_ZONE } from "@/lib/thursdays";

/** The Thursday Home shows (first from today in New York); null if none. */
export async function currentThursdayId(now = new Date()) {
  await syncThursdays(now);
  const e = await db.breakfastEvent.findFirst({
    where: { date: { gte: nyToday(now) } },
    orderBy: { date: "asc" },
    select: { id: true },
  });
  return e?.id ?? null;
}

const orderInclude = {
  member: { select: { name: true } },
  lines: {
    orderBy: { id: "asc" },
    select: { itemName: true, quantity: true, selectedOptions: true },
  },
} as const;

/** Orderable menu for a Thursday, with options grouped for the order form. */
export async function orderableMenu(eventId: string) {
  const items = await db.menuItem.findMany({
    where: { eventId, orderable: true },
    orderBy: { sortOrder: "asc" },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    optionGroups: Object.entries(
      Object.groupBy(i.options, (o) => o.group) as Record<string, typeof i.options>,
    ).map(([group, opts]) => ({ group, labels: opts.map((o) => o.label) })),
  }));
}

/** "Still open" warning (decision #34): ordering left open into the afternoon of the day. */
function stillOpenLate(event: { date: Date; status: string }, now: Date) {
  if (event.status !== "ORDERING_OPEN") return false;
  if (event.date.getTime() !== nyToday(now).getTime()) return false;
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  return hour >= 14;
}

export async function getKitchen(eventId: string, now = new Date()) {
  await syncThursdays(now);
  const event = await db.breakfastEvent.findUnique({
    where: { id: eventId },
    include: {
      rsvps: { where: { answer: "YES" }, select: { memberId: true } },
      orders: { orderBy: { placedAt: "asc" }, include: orderInclude },
    },
  });
  if (!event) return null;

  const yes = new Set(event.rsvps.map((r) => r.memberId));
  const live = event.orders.filter((o) => o.status !== "CANCELLED");
  const cards = live.map((o) => ({
    id: o.id,
    status: o.status,
    name: o.member?.name ?? o.guestName ?? "Guest",
    tag: orderTag(o, yes),
    summary: orderSummary(o.lines),
    notes: o.notes,
  }));

  return {
    id: event.id,
    date: event.date,
    status: event.status,
    orderingEnabled: event.orderingEnabled,
    open: isOrderingOpen(event),
    canOpen: canOpenOrdering(event, nyToday(now)),
    stillOpenLate: stillOpenLate(event, now),
    columns: BOARD.map((status) => ({ status, cards: cards.filter((c) => c.status === status) })),
    activeOrders: live.filter((o) => o.status !== "PICKED_UP").length,
    headcount: headcount(yes, event.orders).total,
    totals: itemTotals(live.filter((o) => o.status !== "PICKED_UP")),
  };
}

export type Kitchen = NonNullable<Awaited<ReturnType<typeof getKitchen>>>;

/** A member's own order for a Thursday (including a cancelled one, so it can be re-placed). */
export async function getMyOrder(eventId: string, memberId: string) {
  const order = await db.order.findUnique({
    where: { eventId_memberId: { eventId, memberId } },
    include: {
      lines: {
        orderBy: { id: "asc" },
        select: { menuItemId: true, itemName: true, quantity: true, selectedOptions: true },
      },
    },
  });
  return order && { ...order, summary: orderSummary(order.lines) };
}

/** Members for the walk-in name suggestions. */
export function memberNames() {
  return db.member.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
