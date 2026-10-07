import { Suspense } from "react";
import { PageTitle } from "@/components/bc";
import { getCurrentMember } from "@/lib/dal";
import { STATUS_LABEL } from "@/lib/event-lifecycle";
import { listUpcomingEvents, type UpcomingEvent } from "@/lib/events";
import { sponsorSummary } from "@/lib/sponsorship-display";
import { formatShortThursday } from "@/lib/thursdays";
import { cn } from "@/lib/utils";

// Schedule (design: "Schedule"). Sponsor this + the organizer's inline menu editing land in M4.
export default function SchedulePage() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
      <PageTitle>Schedule</PageTitle>
      <Suspense fallback={<p className="text-muted-foreground">Loading Thursdays…</p>}>
        <ScheduleList />
      </Suspense>
    </div>
  );
}

async function ScheduleList() {
  await getCurrentMember();
  const { events, sponsorshipAmountCents } = await listUpcomingEvents();
  return events.map((event) => (
    <ScheduleCard key={event.id} event={event} amountCents={sponsorshipAmountCents} />
  ));
}

function ScheduleCard({ event, amountCents }: { event: UpcomingEvent; amountCents: number }) {
  const skipped = event.status === "SKIPPED";
  const cancelled = event.status === "CANCELLED";
  const item = event.menuItems[0];
  const sponsors = item
    ? sponsorSummary(item.sponsorships, event.sponsorsNeeded, amountCents)
    : null;

  return (
    <article
      className={cn(
        "flex items-center justify-between gap-4 rounded-[18px] border-[3px] border-border bg-card px-[22px] py-[18px] shadow-chunky",
        skipped && "opacity-60",
      )}
    >
      <div>
        <h2 className="font-heading text-2xl text-destructive uppercase">
          {formatShortThursday(event.date)}
        </h2>
        <p className="mt-1 text-lg font-bold">
          {skipped
            ? `No breakfast: ${event.skipReason ?? "Holiday"}`
            : (item?.name ?? "No menu yet")}
        </p>
        {!skipped && sponsors && (
          <p
            className={cn(
              "mt-0.5 text-sm",
              sponsors.fullySponsored ? "text-foreground" : "text-destructive",
            )}
          >
            {sponsors.text}
          </p>
        )}
      </div>
      <div className="flex-none text-right">
        <p
          className={cn(
            "text-xs font-bold uppercase",
            skipped || cancelled ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {STATUS_LABEL[event.status]}
        </p>
        {!skipped && !cancelled && (
          <p className="mt-1 text-xs text-muted-foreground">
            {event.orderingEnabled ? "Ordering on" : "RSVP only"}
          </p>
        )}
      </div>
    </article>
  );
}
