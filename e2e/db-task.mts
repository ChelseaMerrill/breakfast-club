// Dev-database helper for the e2e tests. Run with tsx (Playwright's loader can't import the
// ESM Prisma client). Prints JSON. Refuses to run without ALLOW_SEED=true, so it can only
// touch the local dev database.
import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { nyToday } from "../src/lib/thursdays";

if (process.env.ALLOW_SEED !== "true") {
  console.error("db-task: refusing to run without ALLOW_SEED=true (dev database only)");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});
const [task, ...args] = process.argv.slice(2);

async function run(): Promise<unknown> {
  switch (task) {
    case "member-id": {
      const m = await db.member.findFirstOrThrow({
        where: { name: args[0], slackUserId: { startsWith: "SEED_" } },
        select: { id: true },
      });
      return m.id;
    }
    // ---- M5 Payments (cleaned up with reset-menu) ----
    case "payments-setup": {
      // Gives a Thursday a menu item with one unpaid sponsorship by a seed member.
      const [eventId, itemName, memberName] = args;
      const member = await db.member.findFirstOrThrow({
        where: { name: memberName, slackUserId: { startsWith: "SEED_" } },
        select: { id: true },
      });
      const item = await db.menuItem.create({
        data: {
          eventId,
          name: itemName,
          sponsorships: {
            create: { createdById: member.id, members: { create: { memberId: member.id } } },
          },
        },
        select: { sponsorships: { select: { id: true } } },
      });
      return item.sponsorships[0].id;
    }
    case "payments-summary": {
      // Collected / Outstanding over every sponsorship, and how many are on Home's Thursday.
      const all = await db.sponsorship.findMany({
        select: { amountCents: true, paid: true, menuItem: { select: { eventId: true } } },
      });
      const home = await db.breakfastEvent.findFirst({
        where: { date: { gte: nyToday() } },
        orderBy: { date: "asc" },
        select: { id: true },
      });
      const sum = (paid: boolean) =>
        all.filter((s) => s.paid === paid).reduce((n, s) => n + s.amountCents, 0);
      return {
        collectedCents: sum(true),
        outstandingCents: sum(false),
        thisWeekCount: all.filter((s) => s.menuItem.eventId === home?.id).length,
      };
    }
    case "sponsorship-paid": {
      const s = await db.sponsorship.findUnique({
        where: { id: args[0] },
        select: { paid: true, paidAt: true },
      });
      return s && { paid: s.paid, paidAt: s.paidAt?.toISOString() ?? null };
    }
    case "last-scheduled": {
      // Furthest-out scheduled Thursday with no menu, so seed weeks stay untouched.
      const e = await db.breakfastEvent.findFirst({
        where: { date: { gte: nyToday() }, status: "SCHEDULED", menuItems: { none: {} } },
        orderBy: { date: "desc" },
        select: { id: true, date: true, orderingEnabled: true },
      });
      const last = await db.breakfastEvent.findFirst({
        orderBy: { date: "desc" },
        select: { date: true },
      });
      return (
        e && {
          id: e.id,
          date: e.date.toISOString(),
          orderingEnabled: e.orderingEnabled,
          lastDate: last!.date.toISOString(),
        }
      );
    }
    case "reset-event": {
      const [id, lastDateIso, orderingEnabled] = args;
      await db.breakfastEvent.update({
        where: { id },
        data: {
          status: "SCHEDULED",
          skipReason: null,
          orderingEnabled: orderingEnabled === "true",
        },
      });
      const { count } = await db.breakfastEvent.deleteMany({
        where: { date: { gt: new Date(lastDateIso) } },
      });
      return { removed: count };
    }
    case "sponsor-target": {
      // Furthest-out scheduled Thursday with no menu, for the M4 menu & sponsorship tests.
      const e = await db.breakfastEvent.findFirst({
        where: { date: { gte: nyToday() }, status: "SCHEDULED", menuItems: { none: {} } },
        orderBy: { date: "desc" },
        select: { id: true, date: true, sponsorsNeeded: true },
      });
      return e && { id: e.id, date: e.date.toISOString(), sponsorsNeeded: e.sponsorsNeeded };
    }
    case "menu-state": {
      const e = await db.breakfastEvent.findUniqueOrThrow({
        where: { id: args[0] },
        select: {
          sponsorsNeeded: true,
          menuItems: { select: { name: true, _count: { select: { sponsorships: true } } } },
        },
      });
      return {
        sponsorsNeeded: e.sponsorsNeeded,
        items: e.menuItems.map((i) => ({ name: i.name, sponsorships: i._count.sponsorships })),
      };
    }
    case "reset-menu": {
      // Removes the Thursday's menu item and its sponsorships, and restores sponsors needed.
      const [id, sponsorsNeeded] = args;
      const items = await db.menuItem.findMany({ where: { eventId: id }, select: { id: true } });
      const menuItemId = { in: items.map((i) => i.id) };
      const { count } = await db.sponsorship.deleteMany({ where: { menuItemId } });
      await db.menuItem.deleteMany({ where: { eventId: id } });
      await db.breakfastEvent.update({
        where: { id },
        data: { sponsorsNeeded: Number(sponsorsNeeded) },
      });
      return { sponsorshipsRemoved: count, itemsRemoved: items.length };
    }
    case "home-menu": {
      // What the Home Menu card should show: the first Thursday from today on.
      const e = await db.breakfastEvent.findFirst({
        where: { date: { gte: nyToday() } },
        orderBy: { date: "asc" },
        select: { status: true, menuItems: { select: { name: true }, take: 1 } },
      });
      return e && { status: e.status, item: e.menuItems[0]?.name ?? null };
    }
    case "home-event": {
      // The Thursday Home shows: first one from today (New York) onward.
      const e = await db.breakfastEvent.findFirstOrThrow({
        where: { date: { gte: nyToday() } },
        orderBy: { date: "asc" },
        select: { id: true, date: true, status: true, skipReason: true, rsvpDeadline: true },
      });
      return {
        ...e,
        date: e.date.toISOString(),
        rsvpDeadline: e.rsvpDeadline?.toISOString() ?? null,
      };
    }
    case "set-event": {
      // Only the fields RSVP tests need to pin down.
      const [id, json] = args;
      const v = JSON.parse(json) as {
        rsvpDeadline?: string | null;
        status?: "SCHEDULED" | "ORDERING_OPEN" | "ORDERING_CLOSED" | "SKIPPED" | "CANCELLED";
        skipReason?: string | null;
      };
      await db.breakfastEvent.update({
        where: { id },
        data: {
          ...("rsvpDeadline" in v && {
            rsvpDeadline: v.rsvpDeadline ? new Date(v.rsvpDeadline) : null,
          }),
          ...(v.status && { status: v.status }),
          ...("skipReason" in v && { skipReason: v.skipReason }),
        },
      });
      return { ok: true };
    }
    case "clear-rsvps": {
      const [eventId, ...names] = args;
      const { count } = await db.rsvp.deleteMany({
        where: { eventId, member: { name: { in: names }, slackUserId: { startsWith: "SEED_" } } },
      });
      return { removed: count };
    }
    case "get-settings": {
      const s = await db.appSettings.findUnique({ where: { id: 1 } });
      return (
        s && {
          sponsorshipAmountCents: s.sponsorshipAmountCents,
          rsvpDeadlineWeekday: s.rsvpDeadlineWeekday,
          rsvpDeadlineTime: s.rsvpDeadlineTime,
          remindersEnabled: s.remindersEnabled,
        }
      );
    }
    case "set-settings": {
      const v = JSON.parse(args[0]) as {
        sponsorshipAmountCents: number;
        rsvpDeadlineWeekday: number;
        rsvpDeadlineTime: string;
        remindersEnabled: boolean;
      };
      await db.appSettings.upsert({ where: { id: 1 }, update: v, create: { id: 1, ...v } });
      return { ok: true };
    }
    case "ordering-state": {
      // This Thursday's ordering fields, so the ordering tests can put them back.
      const [eventId] = args;
      const e = await db.breakfastEvent.findUniqueOrThrow({
        where: { id: eventId },
        select: { status: true, orderingEnabled: true },
      });
      const items = await db.menuItem.findMany({
        where: { eventId },
        select: { id: true, name: true, orderable: true },
      });
      return { ...e, items };
    }
    case "ordering-reset": {
      // Remove every order for the Thursday and set its ordering fields.
      const [eventId, json] = args;
      const v = JSON.parse(json) as {
        status: "SCHEDULED" | "ORDERING_OPEN" | "ORDERING_CLOSED";
        orderingEnabled: boolean;
      };
      const { count } = await db.order.deleteMany({ where: { eventId } });
      await db.breakfastEvent.update({
        where: { id: eventId },
        data: { ...v, orderingOpenedAt: null, orderingClosedAt: null, orderingAutoClosed: false },
      });
      return { removedOrders: count };
    }
    case "set-options": {
      // Replace a menu item's options: args = menuItemId, group, ...labels (none = clear).
      const [menuItemId, group, ...labels] = args;
      await db.itemOption.deleteMany({ where: { menuItemId } });
      if (group && labels.length) {
        await db.itemOption.createMany({
          data: labels.map((label, sortOrder) => ({ menuItemId, group, label, sortOrder })),
        });
      }
      return { ok: true };
    }
    default:
      throw new Error(`unknown task ${task}`);
  }
}

run()
  .then((out) => console.log(JSON.stringify(out)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
