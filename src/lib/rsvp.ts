// RSVP & headcount rules (docs/business-rules.md → RSVP & headcount). Pure functions.
import type { EventStatus, OrderStatus } from "@/generated/prisma/enums";
import { isUpcoming } from "@/lib/event-lifecycle";
import { nyWallTimeToUtc } from "@/lib/thursdays";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type RsvpSettings = { rsvpDeadlineWeekday: number; rsvpDeadlineTime: string };

/**
 * When RSVPs close for a Thursday: the event's own `rsvpDeadline` if set, otherwise the
 * settings' weekday/time (Wednesday 5pm ET) in the days before it.
 */
export function rsvpDeadlineFor(
  event: { date: Date; rsvpDeadline: Date | null },
  settings: RsvpSettings,
): Date {
  if (event.rsvpDeadline) return event.rsvpDeadline;
  const daysBefore = (event.date.getUTCDay() - settings.rsvpDeadlineWeekday + 7) % 7;
  return nyWallTimeToUtc(
    new Date(event.date.getTime() - daysBefore * DAY_MS),
    settings.rsvpDeadlineTime,
  );
}

/** "Wed 5pm ET" / "Wed 5:30pm ET" — for "RSVP by …" and "RSVPs closed …". */
export function deadlineLabel(settings: RsvpSettings, suffix = " ET"): string {
  const [h, m] = settings.rsvpDeadlineTime.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
  return `${WEEKDAYS[settings.rsvpDeadlineWeekday]} ${time}${suffix}`;
}

const RSVP_STATUSES: EventStatus[] = ["SCHEDULED", "ORDERING_OPEN", "ORDERING_CLOSED"];

export type RsvpCheck = { ok: true } | { ok: false; reason: "unavailable" | "closed" };

/** Members can RSVP until the deadline; the organizer can edit anytime (but not skipped/past weeks). */
export function canRsvp(
  event: { date: Date; status: EventStatus },
  deadline: Date,
  { now, today, isOrganizer }: { now: Date; today: Date; isOrganizer: boolean },
): RsvpCheck {
  if (!isUpcoming(event, today) || !RSVP_STATUSES.includes(event.status)) {
    return { ok: false, reason: "unavailable" };
  }
  if (!isOrganizer && now.getTime() >= deadline.getTime()) return { ok: false, reason: "closed" };
  return { ok: true };
}

export type HeadcountOrder = { memberId: string | null; status: OrderStatus };

/** Headcount = Yes RSVPs + non-cancelled orders from people without a Yes (walk-ins, guests). */
export function headcount(yesMemberIds: Iterable<string>, orders: HeadcountOrder[]) {
  const yes = new Set(yesMemberIds);
  const walkIns = orders.filter(
    (o) => o.status !== "CANCELLED" && (o.memberId === null || !yes.has(o.memberId)),
  ).length;
  return { yes: yes.size, walkIns, total: yes.size + walkIns };
}
