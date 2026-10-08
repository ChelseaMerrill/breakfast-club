// "Ordering is open" post to #108state (open-questions #55). Chelsea writes the message each
// week, since what people should put in Customize depends on that day's breakfast.
import type { SlackMessage } from "@/lib/slack";

export const ORDERING_MESSAGE_MAX = 1000;

/** The text the box starts with; Chelsea edits it before posting. */
export function defaultOrderingMessage(itemName: string | null): string {
  return itemName
    ? `Ordering is open! It's ${itemName} today. Place your order in Breakfast Club, and use Customize to tell me how you'd like it.`
    : "Ordering is open! Place your order in Breakfast Club, and use Customize to tell me how you'd like it.";
}

/** Slack treats &, < and > as markup; escape them so the message shows exactly as typed. */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function orderingOpenMessage(
  message: string,
  { appUrl, eventId }: { appUrl?: string; eventId: string },
): SlackMessage {
  const body = escapeSlackText(message.trim());
  const url = appUrl ? `${appUrl.replace(/\/+$/, "")}/order/${eventId}` : null;
  return {
    text: `:pancakes: ${body}`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `:pancakes: ${body}` } },
      ...(url
        ? [
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  style: "primary",
                  text: { type: "plain_text", text: "Place your order" },
                  url,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
