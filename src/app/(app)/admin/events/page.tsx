import { Suspense } from "react";
import { MintButton, PageTitle } from "@/components/bc";
import { SkipControl } from "@/components/skip-control";
import { requireOrganizer } from "@/lib/dal";
import { STATUS_LABEL, canRestore, canToggleOrdering } from "@/lib/event-lifecycle";
import { listUpcomingEvents, recentAutoClosedEvent, type UpcomingEvent } from "@/lib/events";
import { formatShortThursday, formatThursday, nyToday } from "@/lib/thursdays";
import { cn } from "@/lib/utils";
import { addNextThursday, restoreThursday, toggleOrderingEnabled } from "./actions";

// Thursdays (design: organizer "Thursdays" screen, route /admin/events).
export default function ThursdaysPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageTitle>Thursdays</PageTitle>
      <p className="text-[13px] text-muted-foreground">
        Next 8 Thursdays are created automatically. Skipped and cancelled weeks get no Tuesday
        reminder.
      </p>
      <Suspense fallback={<p className="text-muted-foreground">Loading Thursdays…</p>}>
        <ThursdayList />
      </Suspense>
    </div>
  );
}

async function ThursdayList() {
  await requireOrganizer();
  const [{ events }, autoClosed] = await Promise.all([
    listUpcomingEvents(),
    recentAutoClosedEvent(),
  ]);
  const today = nyToday();

  return (
    <>
      {autoClosed && (
        <p
          role="status"
          className="rounded-[14px] border-2 border-border bg-card px-4 py-3 text-sm"
        >
          Ordering for {formatThursday(autoClosed.date)} was still open at midnight, so it was
          closed automatically.
        </p>
      )}
      {events.map((event) => (
        <ThursdayRow key={event.id} event={event} today={today} />
      ))}
      <form action={addNextThursday} className="mt-2">
        <MintButton type="submit" className="px-5 py-2.5 text-[13px]">
          + Add next Thursday
        </MintButton>
      </form>
    </>
  );
}

function ThursdayRow({ event, today }: { event: UpcomingEvent; today: Date }) {
  const skipped = event.status === "SKIPPED";
  const dateLabel = formatShortThursday(event.date);
  const canToggle = canToggleOrdering(event, today);

  return (
    <article className="grid grid-cols-1 items-center gap-4 rounded-[18px] border-[3px] border-border bg-card px-[22px] py-4 shadow-chunky md:grid-cols-[1.2fr_1fr_auto]">
      <div>
        <h2 className="font-heading text-[22px] uppercase">{dateLabel}</h2>
        <p className="my-0.5 font-bold">
          {skipped
            ? `No breakfast: ${event.skipReason ?? "Holiday"}`
            : (event.menuItems[0]?.name ?? "No menu yet")}
        </p>
        <p
          className={cn(
            "text-xs font-bold uppercase",
            skipped || event.status === "CANCELLED" ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {STATUS_LABEL[event.status]}
        </p>
      </div>

      <form action={toggleOrderingEnabled}>
        <input type="hidden" name="eventId" value={event.id} />
        <button
          type="submit"
          role="switch"
          aria-checked={event.orderingEnabled}
          disabled={!canToggle}
          title={
            canToggle ? undefined : "Can't change once ordering has opened or the week is skipped"
          }
          className="flex cursor-pointer items-center gap-2.5 text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className={cn(
              "relative inline-block h-5 w-[38px] rounded-[10px]",
              event.orderingEnabled ? "bg-primary" : "bg-[#C9B79C]",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white transition-[left]",
                event.orderingEnabled ? "left-5" : "left-0.5",
              )}
            />
          </span>
          Ordering enabled
        </button>
      </form>

      <div className="flex gap-2">
        {skipped ? (
          canRestore(event, today) && (
            <form action={restoreThursday}>
              <input type="hidden" name="eventId" value={event.id} />
              <button
                type="submit"
                className="cursor-pointer rounded-[20px] border-2 border-border px-3.5 py-2 text-xs font-bold text-muted-foreground uppercase"
              >
                Restore
              </button>
            </form>
          )
        ) : event.status === "SCHEDULED" ? (
          <SkipControl eventId={event.id} dateLabel={dateLabel} />
        ) : null}
      </div>
    </article>
  );
}
