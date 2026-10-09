// Runs the Wednesday unpaid-sponsor DMs (open-questions #56). Mirrors the Tuesday reminder:
// claims this week's Thursday (paymentReminderSentAt) so the two Wednesday crons can't both
// send, then DMs each sponsor once with everything they still owe.
import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import {
  decidePaymentReminder,
  groupBySponsor,
  paymentReminderMessage,
  type PaymentSkipReason,
} from "@/lib/payment-reminder";
import { postDirectMessage, slackConfig } from "@/lib/slack";
import { nyToday } from "@/lib/thursdays";

export type PaymentReminderResult =
  | { status: "sent"; thursday: string; sponsors: number; failed: number }
  | { status: "skipped"; reason: PaymentSkipReason | "slack-not-configured"; thursday?: string }
  | { status: "error"; thursday: string; error: string };

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function runPaymentReminder(now = new Date()): Promise<PaymentReminderResult> {
  await syncThursdays(now);
  const event = await db.breakfastEvent.findFirst({
    where: { date: { gte: nyToday(now) } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, paymentReminderSentAt: true },
  });
  const decision = decidePaymentReminder({ now, event });
  const thursday = event ? day(event.date) : undefined;
  if (!decision.send) return { status: "skipped", reason: decision.reason, thursday };
  if (!event || !thursday) return { status: "skipped", reason: "no-thursday" };
  if (!slackConfig()) return { status: "skipped", reason: "slack-not-configured", thursday };

  const claim = await db.breakfastEvent.updateMany({
    where: { id: event.id, paymentReminderSentAt: null },
    data: { paymentReminderSentAt: new Date() },
  });
  if (claim.count !== 1) return { status: "skipped", reason: "already-sent", thursday };

  // Unpaid sponsorships for this Thursday and earlier; skipped/cancelled weeks don't count.
  const unpaid = await db.sponsorship.findMany({
    where: {
      paid: false,
      menuItem: {
        event: { date: { lte: event.date }, status: { notIn: ["SKIPPED", "CANCELLED"] } },
      },
    },
    select: {
      amountCents: true,
      menuItem: { select: { name: true, event: { select: { date: true } } } },
      members: { select: { member: { select: { slackUserId: true } } } },
    },
  });
  const bySponsor = groupBySponsor(
    unpaid.map((s) => ({
      itemName: s.menuItem.name,
      eventDate: s.menuItem.event.date,
      amountCents: s.amountCents,
      members: s.members.map((m) => m.member),
    })),
  );

  let failed = 0;
  for (const [slackUserId, lines] of bySponsor) {
    const result = await postDirectMessage(slackUserId, paymentReminderMessage(lines));
    if (!result.ok) {
      failed++;
      console.error(
        "[payment-reminder] DM failed:",
        result.reason === "slack-error" ? result.error : result.reason,
      );
    }
  }
  if (failed > 0 && failed === bySponsor.size) {
    // Nothing went out (Slack down, bad token…): release the claim so the second cron retries.
    await db.breakfastEvent.update({
      where: { id: event.id },
      data: { paymentReminderSentAt: null },
    });
    return { status: "error", thursday, error: "every Slack DM failed" };
  }
  return { status: "sent", thursday, sponsors: bySponsor.size, failed };
}
