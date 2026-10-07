import { Suspense } from "react";
import { PageTitle } from "@/components/bc";
import { AddSponsorByName, MenuItemEditor } from "@/components/schedule/organizer-menu-controls";
import { SponsorThis } from "@/components/schedule/sponsor-this";
import { getCurrentMember } from "@/lib/dal";
import { STATUS_LABEL } from "@/lib/event-lifecycle";
import { listUpcomingEvents, type UpcomingEvent } from "@/lib/events";
import { formatDollars, sponsorSummary, sponsorshipLabel } from "@/lib/sponsorship-display";
import {
  MAX_SPONSORS_NEEDED,
  canEditMenu,
  canSponsor,
  minSponsorsNeeded,
} from "@/lib/sponsorship-rules";
import { listCoworkers } from "@/lib/sponsorships";
import { formatShortThursday, nyToday } from "@/lib/thursdays";
import { cn } from "@/lib/utils";
import { changeSponsorsNeeded, removeSponsorship } from "./actions";

// Schedule (design: "Schedule"): every upcoming Thursday with its menu item and sponsors.
// Members can *Sponsor this*; the organizer edits the menu inline.
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

type Viewer = { isOrganizer: boolean; coworkers: { id: string; name: string }[] };

async function ScheduleList() {
  const member = await getCurrentMember();
  const [{ events, sponsorshipAmountCents }, coworkers] = await Promise.all([
    listUpcomingEvents(),
    listCoworkers(member.id),
  ]);
  const viewer = { isOrganizer: member.isOrganizer, coworkers };
  const today = nyToday();
  return events.map((event) => (
    <ScheduleCard
      key={event.id}
      event={event}
      amountCents={sponsorshipAmountCents}
      viewer={viewer}
      today={today}
    />
  ));
}

const roundButton =
  "flex size-7 items-center justify-center rounded-full border-2 border-border bg-white font-bold disabled:cursor-not-allowed disabled:opacity-40";

function ScheduleCard({
  event,
  amountCents,
  viewer,
  today,
}: {
  event: UpcomingEvent;
  amountCents: number;
  viewer: Viewer;
  today: Date;
}) {
  const skipped = event.status === "SKIPPED";
  const cancelled = event.status === "CANCELLED";
  const item = event.menuItems[0];
  const sponsorships = item?.sponsorships ?? [];
  const sponsors = item ? sponsorSummary(sponsorships, event.sponsorsNeeded, amountCents) : null;
  const dateLabel = formatShortThursday(event.date);
  const editable = viewer.isOrganizer && canEditMenu(event, today);
  const showSponsor = canSponsor(
    { event, hasMenuItem: !!item, sponsorshipCount: sponsorships.length },
    today,
  );

  return (
    <article
      className={cn(
        "flex items-center justify-between gap-4 rounded-[18px] border-[3px] border-border bg-card px-[22px] py-[18px] shadow-chunky",
        skipped && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-2xl text-destructive uppercase">{dateLabel}</h2>
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

        {viewer.isOrganizer && sponsorships.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label={`Sponsors for ${dateLabel}`}>
            {sponsorships.map((s) => {
              const label = sponsorshipLabel(s);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 rounded-full border-2 border-border bg-white py-0.5 pr-1 pl-2.5 text-xs"
                >
                  {label}
                  <form action={removeSponsorship}>
                    <input type="hidden" name="sponsorshipId" value={s.id} />
                    <button
                      type="submit"
                      aria-label={`Remove ${label}`}
                      title="Remove"
                      className="rounded-full px-1.5 font-bold text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {item && (
            <SponsorThis
              eventId={event.id}
              itemName={item.name}
              canSponsor={showSponsor}
              coworkers={viewer.coworkers}
              amountLabel={formatDollars(amountCents)}
            />
          )}
          {editable && (
            <>
              <MenuItemEditor eventId={event.id} name={item?.name ?? ""} dateLabel={dateLabel} />
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <form action={changeSponsorsNeeded}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="delta" value="-1" />
                  <button
                    type="submit"
                    className={roundButton}
                    aria-label={`Fewer sponsors needed for ${dateLabel}`}
                    disabled={event.sponsorsNeeded <= minSponsorsNeeded(sponsorships.length)}
                  >
                    −
                  </button>
                </form>
                <form action={changeSponsorsNeeded}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <input type="hidden" name="delta" value="1" />
                  <button
                    type="submit"
                    className={roundButton}
                    aria-label={`More sponsors needed for ${dateLabel}`}
                    disabled={event.sponsorsNeeded >= MAX_SPONSORS_NEEDED}
                  >
                    +
                  </button>
                </form>
                <span>
                  {event.sponsorsNeeded}{" "}
                  {event.sponsorsNeeded === 1 ? "sponsor needed" : "sponsors needed"}
                </span>
              </div>
              {item && <AddSponsorByName eventId={event.id} dateLabel={dateLabel} />}
            </>
          )}
        </div>
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
