// Thursday lifecycle rules (docs/business-rules.md → BreakfastEvents). Pure functions; the
// database side lives in src/lib/events.ts.
import type { EventStatus } from "@/generated/prisma/enums";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How far ahead the schedule is kept filled (decision #35). */
export const WEEKS_AHEAD = 8;

export type LifecycleEvent = { date: Date; status: EventStatus };

const DONE: EventStatus[] = ["COMPLETED", "SKIPPED", "CANCELLED"];

export const isUpcoming = (e: { date: Date }, today: Date) => e.date.getTime() >= today.getTime();

/** Thursdays from `wanted` that don't exist yet. */
export function missingThursdays(existing: Date[], wanted: Date[]): Date[] {
  const have = new Set(existing.map((d) => d.getTime()));
  return wanted.filter((d) => !have.has(d.getTime()));
}

export const nextThursdayAfter = (last: Date) => new Date(last.getTime() + WEEK_MS);

/**
 * What a past Thursday becomes at the midnight-NY rollover (decisions #33, #34).
 * `today` is today's New York date (see nyToday). Returns null when nothing changes.
 */
export function rolloverUpdate(event: LifecycleEvent, today: Date, now: Date) {
  if (isUpcoming(event, today) || DONE.includes(event.status)) return null;
  if (event.status === "ORDERING_OPEN") {
    return {
      status: "COMPLETED" as const,
      orderingClosedAt: now,
      orderingAutoClosed: true,
    };
  }
  return { status: "COMPLETED" as const };
}

export const canSkip = (e: LifecycleEvent, today: Date) =>
  isUpcoming(e, today) && e.status === "SCHEDULED";

export const canRestore = (e: LifecycleEvent, today: Date) =>
  isUpcoming(e, today) && e.status === "SKIPPED";

/** Ordering on/off can only change before ordering has been opened. */
export const canToggleOrdering = canSkip;

export const STATUS_LABEL: Record<EventStatus, string> = {
  SCHEDULED: "Scheduled",
  ORDERING_OPEN: "Ordering open",
  ORDERING_CLOSED: "Ordering closed",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};
