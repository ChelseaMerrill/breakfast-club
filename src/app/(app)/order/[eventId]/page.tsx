import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/bc";
import { OrderForm } from "@/components/order-form";
import { getCurrentMember } from "@/lib/dal";
import { db } from "@/lib/db";
import { getMyOrder, orderableMenu } from "@/lib/kitchen";
import { STATUS_LABEL, canEditOwnOrder, canPlaceOrder, isOrderingOpen } from "@/lib/ordering";
import { formatThursday } from "@/lib/thursdays";
import { cancelMyOrder } from "../actions";

// Place your order (design: route /order/[eventId]).
export default function OrderPage({ params }: PageProps<"/order/[eventId]">) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <PageTitle>Place your order</PageTitle>
      <Suspense fallback={<p className="text-muted-foreground">Loading the menu…</p>}>
        <OrderContent params={params} />
      </Suspense>
    </div>
  );
}

async function OrderContent({ params }: Pick<PageProps<"/order/[eventId]">, "params">) {
  const { eventId } = await params;
  const member = await getCurrentMember();
  const event = await db.breakfastEvent.findUnique({ where: { id: eventId } });
  if (!event) notFound();
  const [items, mine] = await Promise.all([orderableMenu(eventId), getMyOrder(eventId, member.id)]);
  const day = formatThursday(event.date);

  if (!event.orderingEnabled) {
    return (
      <Message>
        {day} is RSVP only — no orders needed this week. <Link href="/">Back to Home →</Link>
      </Message>
    );
  }
  if (mine && mine.status !== "CANCELLED" && !canEditOwnOrder(mine, event)) {
    return (
      <Message>
        Your order: <b>{mine.summary}</b> — <b>{STATUS_LABEL[mine.status]}</b>. It can&apos;t be
        changed now. <Link href="/">Back to Home →</Link>
      </Message>
    );
  }
  if (!isOrderingOpen(event) || !canPlaceOrder(mine, event)) {
    return (
      <Message>
        Ordering opens when Chelsea starts it on Thursday morning.{" "}
        <Link href="/">Back to Home →</Link>
      </Message>
    );
  }
  if (items.length === 0) {
    return <Message>Nothing on {day}&apos;s menu can be ordered yet.</Message>;
  }

  const editing = mine?.status === "PLACED";
  const initial = editing
    ? Object.fromEntries(
        mine.lines.map((l) => [
          l.menuItemId,
          Object.fromEntries(
            (Array.isArray(l.selectedOptions) ? l.selectedOptions : []).map((o) => {
              const opt = o as { group: string; label: string };
              return [opt.group, opt.label];
            }),
          ),
        ]),
      )
    : {};

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {day}. Ordering is open. You can edit your order until it moves to Cooking.
      </p>
      <OrderForm
        // Next keeps recent pages alive (Activity), so tie the form's local state to the
        // order's current version: new server data means a fresh form.
        key={mine ? `${mine.id}:${mine.status}:${mine.statusAt.toISOString()}` : "new"}
        eventId={eventId}
        items={items}
        initial={initial}
        initialNotes={editing ? (mine.notes ?? "") : ""}
        editing={editing}
      />
      {editing && (
        <form action={cancelMyOrder} className="text-center">
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" className="cursor-pointer text-sm font-semibold text-destructive">
            Cancel my order
          </button>
        </form>
      )}
    </>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <p className="text-sm">{children}</p>
    </Card>
  );
}
