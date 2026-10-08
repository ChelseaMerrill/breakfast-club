// "Your order is ready" Slack DM (open-questions #50). Pure helpers; sending happens in
// src/lib/ready-notify.ts after the kitchen tap.
import type { SlackMessage } from "@/lib/slack";

/**
 * Who gets the DM: members who signed in with Slack. Guests (no account) and seed members
 * (fake SEED_ ids in local dev) are skipped.
 */
export function readyDmRecipient(order: {
  member: { slackUserId: string | null } | null;
}): string | null {
  const id = order.member?.slackUserId?.trim();
  if (!id || id.startsWith("SEED_")) return null;
  return /^[UW][A-Z0-9]+$/.test(id) ? id : null;
}

export function readyMessage(
  summary: string,
  { appUrl, eventId }: { appUrl?: string; eventId: string },
): SlackMessage {
  const what = summary || "Your order";
  const text = `:fried_egg: Your breakfast is ready! ${what} — come grab it from the kitchen.`;
  const url = appUrl ? `${appUrl.replace(/\/+$/, "")}/kitchen/${eventId}` : null;
  return {
    text,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:fried_egg: *Your breakfast is ready!*\n${what} — come grab it from the kitchen.`,
        },
      },
      ...(url
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View the kitchen queue" },
                  url,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
