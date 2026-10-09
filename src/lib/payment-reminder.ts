// Wednesday 11am ET Slack DM to sponsors who haven't been marked paid (open-questions #56).
// Pure helpers: when to send, who gets what, and the message. The cron runner lives in
// src/lib/payment-reminder-run.ts.
import { escapeSlackText } from "@/lib/ordering-post";
import { VENMO_HANDLE, VENMO_URL } from "@/lib/payment-info";
import { readyDmRecipient } from "@/lib/ready-dm";
import { nyWeekday } from "@/lib/reminder-decision";
import type { SlackMessage } from "@/lib/slack";
import { formatDollars } from "@/lib/sponsorship-display";
import { formatShortThursday, nyToday, nyWallTimeToUtc } from "@/lib/thursdays";

export const PAYMENT_REMINDER_WEEKDAY = 3; // Wednesday
export const PAYMENT_REMINDER_TIME = "11:00"; // America/New_York

export type PaymentSkipReason = "no-thursday" | "not-reminder-day" | "too-early" | "already-sent";

/** Send on Wednesday at/after 11:00 New York time, once per week (claimed on this Thursday). */
export function decidePaymentReminder({
  now,
  event,
}: {
  now: Date;
  event: { paymentReminderSentAt: Date | null } | null; // this week's Thursday
}): { send: true } | { send: false; reason: PaymentSkipReason } {
  if (!event) return { send: false, reason: "no-thursday" };
  if (nyWeekday(now) !== PAYMENT_REMINDER_WEEKDAY)
    return { send: false, reason: "not-reminder-day" };
  if (now < nyWallTimeToUtc(nyToday(now), PAYMENT_REMINDER_TIME))
    return { send: false, reason: "too-early" };
  if (event.paymentReminderSentAt) return { send: false, reason: "already-sent" };
  return { send: true };
}

export type UnpaidSponsorship = {
  itemName: string;
  eventDate: Date;
  amountCents: number;
  members: { slackUserId: string | null }[];
};

export type OwedLine = { itemName: string; eventDate: Date; amountCents: number };

/**
 * Who to remind: every member on an unpaid sponsorship who signed in with Slack. Names Chelsea
 * typed in (no members) and seed members are skipped. One entry per person, oldest first.
 */
export function groupBySponsor(unpaid: UnpaidSponsorship[]): Map<string, OwedLine[]> {
  const bySponsor = new Map<string, OwedLine[]>();
  const sorted = [...unpaid].sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  for (const s of sorted) {
    for (const m of s.members) {
      const id = readyDmRecipient({ member: m });
      if (!id) continue;
      const lines = bySponsor.get(id) ?? [];
      lines.push({ itemName: s.itemName, eventDate: s.eventDate, amountCents: s.amountCents });
      bySponsor.set(id, lines);
    }
  }
  return bySponsor;
}

export function paymentReminderMessage(lines: OwedLine[]): SlackMessage {
  const total = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const list = lines
    .map(
      (l) =>
        `• ${escapeSlackText(l.itemName)} (${formatShortThursday(l.eventDate)}) — ${formatDollars(l.amountCents)}`,
    )
    .join("\n");
  const owe = lines.length === 1 ? formatDollars(total) : `${formatDollars(total)} in total`;
  const intro = `:wave: Friendly reminder: you're a Breakfast Club sponsor! Please give Chelsea ${owe}.`;
  const how = `Pay with cash or Venmo ${VENMO_HANDLE}. Already paid? Chelsea will mark it soon.`;
  return {
    text: `${intro}\n${list}\n${how}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${intro}\n${list}` } },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Pay with cash or Venmo <${VENMO_URL}|${VENMO_HANDLE}>. _Already paid? Chelsea will mark it soon._`,
        },
      },
    ],
  };
}
