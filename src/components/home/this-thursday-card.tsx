import Link from "next/link";
import { Card } from "@/components/bc";
import type { CurrentMember } from "@/lib/dal";
import { getThisThursday } from "@/lib/this-thursday";
import { formatThursday } from "@/lib/thursdays";
import { RsvpButtons } from "./rsvp-buttons";

/** Design: Home → "This Thursday" card (date, headcount, I'm in / Not this week, In/Out). */
export async function ThisThursdayCard({ member }: { member: CurrentMember }) {
  const thursday = await getThisThursday(member.id, member.isOrganizer);
  if (!thursday) {
    return (
      <Card>
        <p className="text-muted-foreground">No Thursdays on the schedule yet.</p>
      </Card>
    );
  }

  const off = thursday.status === "SKIPPED" || thursday.status === "CANCELLED";
  const { headcount } = thursday;

  return (
    <Card aria-label="This Thursday">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-3xl text-destructive uppercase">
          {formatThursday(thursday.date)}
        </h2>
        {!off && <p className="text-xs text-muted-foreground">RSVP by {thursday.deadlineText}</p>}
      </div>

      {off ? (
        <div role="status" className="rounded-[14px] border-2 border-border bg-muted px-4 py-3">
          <p className="font-bold">
            No breakfast this Thursday
            {thursday.status === "SKIPPED" && `: ${thursday.skipReason ?? "Holiday"}`}
          </p>
          {thursday.nextBreakfastDate && (
            <p className="mt-1 text-sm text-muted-foreground">
              Next breakfast is {formatThursday(thursday.nextBreakfastDate)}.{" "}
              <Link href="/schedule">See the schedule →</Link>
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <p className="font-heading text-[56px] leading-none" aria-label="Headcount">
              {headcount.total}
            </p>
            <p className="text-sm text-muted-foreground">
              coming so far
              <br />
              {headcount.yes} RSVP yes, {headcount.walkIns} walk-in
            </p>
          </div>
          <RsvpButtons
            eventId={thursday.id}
            current={thursday.myAnswer}
            closedText={
              thursday.rsvp.ok
                ? null
                : `RSVPs closed ${thursday.deadlineTextShort}. You can still order as a walk-in.`
            }
          />
          <p className="text-[13px]">
            <span className="text-muted-foreground">In:</span>{" "}
            {thursday.yesNames.join(", ") || "Nobody yet"}
            <br />
            <span className="text-muted-foreground">Out:</span>{" "}
            {thursday.noNames.join(", ") || "Nobody yet"}
          </p>
        </>
      )}
    </Card>
  );
}
