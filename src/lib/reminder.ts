// Posting the Tuesday reminder (docs/slack-integration.md → Tuesday reminder).
import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import { reminderPayload } from "@/lib/reminder-blocks";
import { decideReminder, type SkipReason } from "@/lib/reminder-decision";
import { getSettings, reminderPreview } from "@/lib/settings";
import { postToChannel, slackConfig, type SlackPostResult } from "@/lib/slack";
import { nyToday } from "@/lib/thursdays";

export type WeeklyReminderResult =
  | { status: "sent"; thursday: string }
  | {
      status: "skipped";
      reason: SkipReason | "slack-not-configured" | "nothing-to-send";
      thursday?: string;
    }
  | { status: "error"; error: string; thursday: string };

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Run by the Tuesday crons. Claims the Thursday (sets reminderSentAt only if it's still
 * empty) before posting, so the two crons can never both post; if Slack then fails, the
 * claim is released so the second cron tries again.
 */
export async function runWeeklyReminder(now = new Date()): Promise<WeeklyReminderResult> {
  await syncThursdays(now);
  const [settings, event] = await Promise.all([
    getSettings(),
    db.breakfastEvent.findFirst({
      where: { date: { gte: nyToday(now) } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, status: true, reminderSentAt: true },
    }),
  ]);

  const decision = decideReminder({
    now,
    settings: {
      remindersEnabled: settings.remindersEnabled,
      reminderWeekday: settings.reminderWeekday ?? 2,
      reminderTime: settings.reminderTime ?? "10:00",
    },
    event,
  });
  const thursday = event ? day(event.date) : undefined;
  if (!decision.send) return { status: "skipped", reason: decision.reason, thursday };
  if (!event || !thursday) return { status: "skipped", reason: "no-thursday" };
  if (!slackConfig()) return { status: "skipped", reason: "slack-not-configured", thursday };

  const claimedAt = new Date();
  const claim = await db.breakfastEvent.updateMany({
    where: { id: event.id, reminderSentAt: null },
    data: { reminderSentAt: claimedAt },
  });
  if (claim.count !== 1) return { status: "skipped", reason: "already-sent", thursday };
  const release = () =>
    db.breakfastEvent.updateMany({
      where: { id: event.id, reminderSentAt: claimedAt },
      data: { reminderSentAt: null },
    });

  // Same builder as the Settings preview, for the same Thursday.
  const preview = await reminderPreview(now);
  if (!preview || preview.skipped || day(preview.date) !== thursday) {
    await release();
    return { status: "skipped", reason: "nothing-to-send", thursday };
  }

  const result = await postToChannel(
    reminderPayload(preview.message, { appUrl: process.env.APP_URL }),
  );
  if (!result.ok) {
    await release();
    return { status: "error", error: describeSlackFailure(result), thursday };
  }
  return { status: "sent", thursday };
}

/** Settings → Send test reminder: posts the current preview, marked as a test. */
export async function sendTestReminder(): Promise<{ ok: true } | { ok: false; error: string }> {
  const preview = await reminderPreview();
  if (!preview) return { ok: false, error: "No Thursdays on the schedule yet." };
  if (preview.skipped)
    return { ok: false, error: "This Thursday is skipped, so there's no reminder to send." };
  const result = await postToChannel(
    reminderPayload(preview.message, { appUrl: process.env.APP_URL, test: true }),
  );
  return result.ok ? { ok: true } : { ok: false, error: describeSlackFailure(result) };
}

function describeSlackFailure(result: Exclude<SlackPostResult, { ok: true }>): string {
  return result.reason === "not-configured"
    ? "Slack isn't connected yet."
    : `Slack didn't accept the message (${result.error}).`;
}
