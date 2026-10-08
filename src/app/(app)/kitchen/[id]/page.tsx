import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageTitle } from "@/components/bc";
import { ConfirmSubmit } from "@/components/kitchen/confirm-submit";
import { CookingScenes } from "@/components/kitchen/cooking-scenes";
import { WalkInForm } from "@/components/kitchen/walk-in-form";
import { LiveRefresh } from "@/components/live-refresh";
import { getCurrentMember } from "@/lib/dal";
import { getKitchen, memberNames, orderableMenu, type Kitchen } from "@/lib/kitchen";
import { STATUS_LABEL } from "@/lib/ordering";
import { formatThursday } from "@/lib/thursdays";
import { cn } from "@/lib/utils";
import { closeOrdering, deleteOrder, moveOrder, openOrdering } from "../actions";

// Kitchen view (design: "Kitchen view", route /kitchen/[id]). Everyone can watch; only the
// organizer opens/closes ordering, moves orders and adds walk-ins (decision #21).

const COLUMNS = {
  PLACED: { color: "var(--bc-placed)", next: "Start cooking" },
  COOKING: { color: "var(--bc-cooking)", next: "Mark ready" },
  READY: { color: "var(--bc-ready)", next: "Picked up" },
  PICKED_UP: { color: "var(--bc-picked-up)", next: null },
} as const;

export default function KitchenPage({ params }: PageProps<"/kitchen/[id]">) {
  return (
    <div className="flex flex-col gap-[18px]">
      <PageTitle>Kitchen view</PageTitle>
      <Suspense fallback={<p className="text-muted-foreground">Loading the kitchen…</p>}>
        <KitchenBoard params={params} />
      </Suspense>
    </div>
  );
}

async function KitchenBoard({ params }: Pick<PageProps<"/kitchen/[id]">, "params">) {
  const { id } = await params;
  const member = await getCurrentMember();
  const kitchen = await getKitchen(id);
  if (!kitchen) notFound();
  const org = member.isOrganizer;

  if (!kitchen.orderingEnabled) {
    return (
      <Card>
        <p className="font-bold">
          {formatThursday(kitchen.date)} is RSVP only — no ordering this week.
        </p>
        <Link href="/">Back to Home →</Link>
      </Card>
    );
  }

  const [items, members] = org ? await Promise.all([orderableMenu(id), memberNames()]) : [[], []];

  return (
    <>
      <LiveRefresh />
      <div className="flex flex-wrap items-center gap-3.5">
        {org && <OrderingButton kitchen={kitchen} />}
        <p
          className={cn(
            "text-sm font-bold uppercase",
            kitchen.open ? "text-[var(--bc-green)]" : "text-muted-foreground",
          )}
        >
          {kitchen.open ? "Ordering is open" : "Ordering is closed"}
        </p>
        <div className="flex-1" />
        <p className="text-[13px] text-muted-foreground">
          {formatThursday(kitchen.date)} · {kitchen.activeOrders} orders · {kitchen.headcount}{" "}
          people
        </p>
      </div>

      {org && kitchen.stillOpenLate && (
        <p
          role="status"
          className="rounded-[14px] border-2 border-destructive bg-card px-4 py-3 text-sm"
        >
          Ordering is still open. Close it when breakfast is done — it closes automatically at
          midnight.
        </p>
      )}

      {kitchen.totals.length > 0 && (
        <p className="text-[13px]" aria-label="Item totals">
          <span className="text-muted-foreground">To make: </span>
          {kitchen.totals.map((t) => `${t.name} × ${t.qty}`).join(" · ")}
        </p>
      )}

      {org && (
        <WalkInForm eventId={kitchen.id} items={items} members={members.map((m) => m.name)} />
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
        {kitchen.columns.map((col) => (
          <section
            key={col.status}
            aria-label={STATUS_LABEL[col.status]}
            className="flex flex-col gap-2.5 md:min-h-[260px] rounded-[18px] border-[3px] border-border bg-card p-3.5 shadow-chunky"
          >
            <h2 className="flex flex-wrap justify-between gap-2 font-heading text-xl uppercase">
              <span>{STATUS_LABEL[col.status]}</span>
              <span className="text-destructive">{col.cards.length}</span>
            </h2>
            {col.cards.map((card) => (
              <OrderCard key={card.id} card={card} organizer={org} />
            ))}
          </section>
        ))}
      </div>

      {kitchen.open && <CookingScenes />}
      <p className="text-xs text-[var(--bc-brown-faint)]">
        {org
          ? "Tap a card to advance it. Ordering stays open until you close it."
          : "Only Chelsea moves orders along. This board updates as she goes."}
      </p>
    </>
  );
}

function OrderingButton({ kitchen }: { kitchen: Kitchen }) {
  if (!kitchen.open && !kitchen.canOpen) return null;
  return (
    <form action={kitchen.open ? closeOrdering : openOrdering}>
      <input type="hidden" name="eventId" value={kitchen.id} />
      <button
        type="submit"
        className={cn(
          "cursor-pointer rounded-full border-[3px] border-border px-7 py-3.5 font-bold uppercase shadow-chunky-sm",
          kitchen.open ? "bg-[#FFB4A2]" : "bg-primary",
        )}
      >
        {kitchen.open ? "Close ordering" : "Open ordering"}
      </button>
    </form>
  );
}

type Card = Kitchen["columns"][number]["cards"][number];

function OrderCard({ card, organizer }: { card: Card; organizer: boolean }) {
  const col = COLUMNS[card.status as keyof typeof COLUMNS];
  const body = (
    <>
      <span className="text-[15px] font-bold">
        {card.name} {card.tag && <span className="text-[10px] text-destructive">{card.tag}</span>}
      </span>
      <span className="text-[13px] text-muted-foreground">{card.summary}</span>
      {organizer && card.notes && <span className="text-xs italic">“{card.notes}”</span>}
    </>
  );
  const shell =
    "flex flex-col gap-1 rounded-xl border-2 border-l-8 border-border bg-white p-3 text-left";

  if (!organizer) {
    return (
      <article className={shell} style={{ borderLeftColor: col.color }}>
        {body}
      </article>
    );
  }

  return (
    <article className={cn(shell, "p-0")} style={{ borderLeftColor: col.color }}>
      <form action={moveOrder}>
        <input type="hidden" name="orderId" value={card.id} />
        <input type="hidden" name="from" value={card.status} />
        <input type="hidden" name="move" value="advance" />
        <button
          type="submit"
          disabled={!col.next}
          aria-label={col.next ? `${col.next}: ${card.name}` : `${card.name} (picked up)`}
          className="flex w-full cursor-pointer flex-col gap-1 p-3 pb-1 text-left disabled:cursor-default"
        >
          {body}
          <span className="text-[11px] font-bold text-destructive uppercase">
            {col.next ? `Tap: ${col.next}` : "Done"}
          </span>
        </button>
      </form>
      <div className="flex justify-end gap-4 px-3 pb-2">
        {card.status === "PICKED_UP" && (
          <form action={deleteOrder}>
            <input type="hidden" name="orderId" value={card.id} />
            <ConfirmSubmit
              question={`Delete ${card.name}'s order? This can't be undone.`}
              aria-label={`Delete ${card.name}'s order`}
              className="cursor-pointer text-[11px] font-bold text-destructive uppercase"
            >
              Delete
            </ConfirmSubmit>
          </form>
        )}
        <form action={moveOrder}>
          <input type="hidden" name="orderId" value={card.id} />
          <input type="hidden" name="from" value={card.status} />
          <input type="hidden" name="move" value={card.status === "PLACED" ? "cancel" : "back"} />
          <button
            type="submit"
            className="cursor-pointer text-[11px] font-bold text-muted-foreground uppercase"
          >
            {card.status === "PLACED" ? "Cancel" : "← Back"}
          </button>
        </form>
      </div>
    </article>
  );
}
