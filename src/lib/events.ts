import "server-only";
import { db } from "@/lib/db";
import {
  WEEKS_AHEAD,
  missingThursdays,
  nextThursdayAfter,
  rolloverUpdate,
} from "@/lib/event-lifecycle";
import { nyToday, upcomingThursdays } from "@/lib/thursdays";

/**
 * Keeps BreakfastEvents current (decisions #33–#35): completes past Thursdays (auto-closing
 * forgotten ordering) and tops up to WEEKS_AHEAD Thursdays. Idempotent; runs on page loads
 * and from the reminder cron, since Hobby crons can't run often enough to do this.
 */
export async function syncThursdays(now = new Date()) {
  const today = nyToday(now);

  const stale = await db.breakfastEvent.findMany({
    where: {
      date: { lt: today },
      status: { in: ["SCHEDULED", "ORDERING_OPEN", "ORDERING_CLOSED"] },
    },
    select: { id: true, date: true, status: true },
  });
  for (const event of stale) {
    const data = rolloverUpdate(event, today, now);
    // Guard on the status we read, so a concurrent change isn't overwritten.
    if (data)
      await db.breakfastEvent.updateMany({ where: { id: event.id, status: event.status }, data });
  }

  const wanted = upcomingThursdays(WEEKS_AHEAD, now);
  const existing = await db.breakfastEvent.findMany({
    where: { date: { in: wanted } },
    select: { date: true },
  });
  const missing = missingThursdays(
    existing.map((e) => e.date),
    wanted,
  );
  if (missing.length) {
    await db.breakfastEvent.createMany({
      data: missing.map((date) => ({ date })),
      skipDuplicates: true,
    });
  }
}

/** Adds the Thursday after the last one on the schedule (decision #35). */
export async function addNextThursday() {
  const last = await db.breakfastEvent.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const date = last ? nextThursdayAfter(last.date) : upcomingThursdays(1)[0];
  return db.breakfastEvent.create({ data: { date } });
}

/** Upcoming Thursdays (today onward, New York time) with their menu and sponsors. */
export async function listUpcomingEvents(now = new Date()) {
  await syncThursdays(now);
  const [events, settings] = await Promise.all([
    db.breakfastEvent.findMany({
      where: { date: { gte: nyToday(now) } },
      orderBy: { date: "asc" },
      include: {
        menuItems: {
          orderBy: { sortOrder: "asc" },
          include: {
            sponsorships: {
              orderBy: { createdAt: "asc" },
              include: { members: { include: { member: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    db.appSettings.findUnique({ where: { id: 1 } }),
  ]);

  return {
    sponsorshipAmountCents: settings?.sponsorshipAmountCents ?? 3000,
    events: events.map((e) => ({
      ...e,
      menuItems: e.menuItems.map((item) => ({
        ...item,
        sponsorships: item.sponsorships.map((s) => ({
          ...s,
          members: s.members.map((m) => m.member),
        })),
      })),
    })),
  };
}

export type UpcomingEvent = Awaited<ReturnType<typeof listUpcomingEvents>>["events"][number];

/** The most recent Thursday whose ordering was closed by the rollover, if within the last week. */
export async function recentAutoClosedEvent(now = new Date()) {
  const weekAgo = new Date(nyToday(now).getTime() - 7 * 24 * 60 * 60 * 1000);
  return db.breakfastEvent.findFirst({
    where: { orderingAutoClosed: true, date: { gte: weekAgo } },
    orderBy: { date: "desc" },
    select: { date: true },
  });
}
