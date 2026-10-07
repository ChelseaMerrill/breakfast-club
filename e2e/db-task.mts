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
        status?: "SCHEDULED" | "SKIPPED";
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
