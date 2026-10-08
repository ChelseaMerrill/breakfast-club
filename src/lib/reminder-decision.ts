// Whether the Tuesday cron should post the reminder now (docs/slack-integration.md → Logic,
// open-questions #36). Two crons run on Tuesday (14:00 and 15:00 UTC); the first one at or
// after reminderTime in New York posts, and reminderSentAt stops the second. Pure, so the
// DST and skip rules are unit-tested without a clock or a database.
import { TIME_ZONE, nyToday, nyWallTimeToUtc } from "@/lib/thursdays";

export type ReminderSettings = {
  remindersEnabled: boolean;
  reminderWeekday: number; // 0 = Sunday … 2 = Tuesday
  reminderTime: string; // "10:00", America/New_York
};

export type ReminderEvent = {
  status: string; // EventStatus
  reminderSentAt: Date | null;
};

export type SkipReason =
  | "reminders-off"
  | "no-thursday"
  | "thursday-skipped"
  | "not-reminder-day"
  | "too-early"
  | "already-sent";

export type ReminderDecision = { send: true } | { send: false; reason: SkipReason };

/** Day of the week in New York at an instant (0 = Sunday). */
export function nyWeekday(now: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(
    now,
  );
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function decideReminder({
  now,
  settings,
  event,
}: {
  now: Date;
  settings: ReminderSettings;
  event: ReminderEvent | null; // this week's Thursday (first one from today, New York)
}): ReminderDecision {
  if (!settings.remindersEnabled) return { send: false, reason: "reminders-off" };
  if (!event) return { send: false, reason: "no-thursday" };
  if (event.status === "SKIPPED" || event.status === "CANCELLED")
    return { send: false, reason: "thursday-skipped" };
  if (nyWeekday(now) !== settings.reminderWeekday)
    return { send: false, reason: "not-reminder-day" };
  if (now < nyWallTimeToUtc(nyToday(now), settings.reminderTime))
    return { send: false, reason: "too-early" };
  if (event.reminderSentAt) return { send: false, reason: "already-sent" };
  return { send: true };
}

/**
 * Local-dev-only clock override for the cron route (`?now=<ISO>`), so e2e tests can run "a
 * Tuesday at 10:30 ET" on any day. Ignored unless NODE_ENV is exactly "development" (only
 * `next dev`; `next build`/`next start` and every Vercel deployment run as "production").
 */
export function clockOverride(value: string | null, nodeEnv: string | undefined): Date | null {
  if (nodeEnv !== "development" || !value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}
