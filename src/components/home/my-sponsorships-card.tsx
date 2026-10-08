import { Suspense } from "react";
import { removeSponsorship } from "@/app/(app)/schedule/actions";
import { Card } from "@/components/bc";
import { getCurrentMember } from "@/lib/dal";
import { VENMO_HANDLE, VENMO_URL } from "@/lib/payment-info";
import { formatDollars, sponsorshipLabel } from "@/lib/sponsorship-display";
import { canRemoveOwnSponsorship } from "@/lib/sponsorship-rules";
import { listMySponsorships } from "@/lib/sponsorships";
import { formatShortThursday, nyToday } from "@/lib/thursdays";

/** Home *My sponsorships* card: what you owe ("$30 due" / "Paid ✓"), with Remove while allowed. */
export function MySponsorshipsCard() {
  return (
    <Card className="gap-2.5 p-[22px]" aria-labelledby="my-sponsorships-title">
      <h2 id="my-sponsorships-title" className="text-lg font-bold">
        My sponsorships
      </h2>
      <Suspense fallback={<div className="h-6" />}>
        <MySponsorshipRows />
      </Suspense>
    </Card>
  );
}

async function MySponsorshipRows() {
  const member = await getCurrentMember();
  const mine = await listMySponsorships(member.id);
  const today = nyToday();

  if (mine.length === 0)
    return <p className="text-sm text-muted-foreground">None yet. Pick an item on the Schedule.</p>;

  const owing = mine.some((s) => !s.paid);

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {mine.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2.5 border-t border-border/20 pt-2.5 text-sm"
          >
            <span>
              {s.itemName} · {sponsorshipLabel(s)}
              <span className="block text-xs text-muted-foreground">
                {formatShortThursday(s.eventDate)}
              </span>
            </span>
            <span className="flex items-center gap-2.5">
              <span className={s.paid ? "font-bold text-(--bc-green)" : "font-bold"}>
                {s.paid ? "Paid ✓" : `${formatDollars(s.amountCents)} due`}
              </span>
              {canRemoveOwnSponsorship(s, today) && (
                <form action={removeSponsorship}>
                  <input type="hidden" name="sponsorshipId" value={s.id} />
                  <button
                    type="submit"
                    className="text-xs underline"
                    aria-label={`Remove ${s.itemName} sponsorship (${formatShortThursday(s.eventDate)})`}
                  >
                    Remove
                  </button>
                </form>
              )}
            </span>
          </li>
        ))}
      </ul>
      {owing && (
        <p className="border-t border-border/20 pt-2.5 text-[13px] text-muted-foreground">
          Each sponsor gives Chelsea {formatDollars(mine.find((s) => !s.paid)!.amountCents)}. Pay
          with cash or Venmo{" "}
          <a
            href={VENMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-destructive underline underline-offset-2"
          >
            {VENMO_HANDLE}
          </a>
          .
        </p>
      )}
    </>
  );
}
