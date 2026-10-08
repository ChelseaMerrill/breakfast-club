// Block Kit for the Tuesday reminder (docs/slack-integration.md → Message). The text comes
// from reminder-message.ts, the same builder as the Settings preview, so they always match.
// Payment status is never included (the ReminderMessage has none).
import { reminderMrkdwn, type ReminderMessage } from "@/lib/reminder-message";

export const TEST_REMINDER_NOTE = "Test from Settings — not this week's real reminder.";

export type ReminderPayload = {
  text: string; // plain fallback for notifications and clients without blocks
  blocks: Record<string, unknown>[];
};

export function reminderPayload(
  msg: ReminderMessage,
  { appUrl, test = false }: { appUrl: string | undefined; test?: boolean },
): ReminderPayload {
  const text = reminderMrkdwn(msg);
  const blocks: Record<string, unknown>[] = [];
  if (test) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `:test_tube: ${TEST_REMINDER_NOTE}` }],
    });
  }
  blocks.push({ type: "section", text: { type: "mrkdwn", text } });

  const base = appUrl?.trim().replace(/\/+$/, "");
  if (base) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          action_id: "rsvp",
          text: { type: "plain_text", text: "RSVP" },
          url: `${base}/`,
          style: "primary",
        },
        {
          type: "button",
          action_id: "sponsor",
          text: { type: "plain_text", text: "Sponsor an item" },
          url: `${base}/schedule`,
        },
      ],
    });
  }
  return { text: test ? `[Test] ${text}` : text, blocks };
}
