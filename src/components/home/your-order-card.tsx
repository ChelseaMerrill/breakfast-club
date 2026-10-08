import Link from "next/link";
import { Card } from "@/components/bc";
import { LiveRefresh } from "@/components/live-refresh";
import { getCurrentMember } from "@/lib/dal";
import { db } from "@/lib/db";
import { currentThursdayId, getMyOrder } from "@/lib/kitchen";
import { STATUS_LABEL, canEditOwnOrder, isOrderingOpen } from "@/lib/ordering";
import { cn } from "@/lib/utils";

/** Design: Home → "Your order" (status pill updates live; hidden on RSVP-only weeks). */
export async function YourOrderCard() {
  const member = await getCurrentMember();
  const eventId = await currentThursdayId();
  if (!eventId) return null;
  const event = await db.breakfastEvent.findUnique({ where: { id: eventId } });
  if (!event || !event.orderingEnabled) return null;
  if (event.status === "SKIPPED" || event.status === "CANCELLED") return null;

  const mine = await getMyOrder(eventId, member.id);
  const order = mine && mine.status !== "CANCELLED" ? mine : null;
  const open = isOrderingOpen(event);
  const live = open || (order && order.status !== "PICKED_UP");

  return (
    <Card aria-label="Your order" className="gap-3">
      {live && <LiveRefresh />}
      <h2 className="text-lg font-bold">Your order</h2>
      {order ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {order.summary}
            {canEditOwnOrder(order, event) && (
              <>
                {" · "}
                <Link href={`/order/${eventId}`}>Change</Link>
              </>
            )}
          </p>
          <p
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold uppercase",
              order.status === "READY" ? "bg-secondary" : "bg-[#FFE1B8]",
            )}
          >
            {STATUS_LABEL[order.status]}
          </p>
        </div>
      ) : open ? (
        <Link
          href={`/order/${eventId}`}
          className="rounded-full border-[3px] border-border bg-primary p-3 text-center text-sm font-bold text-foreground uppercase no-underline shadow-chunky-sm hover:text-foreground"
        >
          Place your order
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ordering opens when Chelsea starts it on Thursday morning.
        </p>
      )}
    </Card>
  );
}
