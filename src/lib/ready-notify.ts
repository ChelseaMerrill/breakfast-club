import "server-only";
import { db } from "@/lib/db";
import { orderSummary } from "@/lib/ordering";
import { readyDmRecipient, readyMessage } from "@/lib/ready-dm";
import { postDirectMessage } from "@/lib/slack";

/**
 * DMs the member whose order just moved to Ready. Best effort: never throws, and only
 * sends if the order is still Ready (a quick ← Back cancels it).
 */
export async function notifyOrderReady(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        eventId: true,
        member: { select: { slackUserId: true } },
        lines: {
          orderBy: { id: "asc" },
          select: { itemName: true, quantity: true, selectedOptions: true },
        },
      },
    });
    if (!order || order.status !== "READY") return;
    const recipient = readyDmRecipient(order);
    if (!recipient) return;
    const result = await postDirectMessage(
      recipient,
      readyMessage(orderSummary(order.lines), {
        appUrl: process.env.APP_URL,
        eventId: order.eventId,
      }),
    );
    if (!result.ok && result.reason === "slack-error") {
      console.error("[ready-dm] Slack refused the DM:", result.error);
    }
  } catch (err) {
    console.error("[ready-dm] failed", err);
  }
}
