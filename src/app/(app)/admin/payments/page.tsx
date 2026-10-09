import Link from "next/link";
import { Suspense } from "react";
import { removeSponsorship } from "@/app/(app)/schedule/actions";
import { PaidCheckbox } from "@/components/payments/paid-checkbox";
import { PageTitle } from "@/components/bc";
import { requireOrganizer } from "@/lib/dal";
import {
  PAYMENT_FILTERS,
  filterPayments,
  parsePaymentFilter,
  paymentFilterHref,
  paymentTotals,
} from "@/lib/payments";
import { formatDollars, sponsorshipLabel } from "@/lib/sponsorship-display";
import { listPayments } from "@/lib/sponsorships";
import { formatShortThursday } from "@/lib/thursdays";
import { cn } from "@/lib/utils";

// Payments (design: organizer "Payments" screen, route /admin/payments). Every sponsorship on
// every Thursday; Collected / Outstanding are over all of them, whatever the filter.
export default function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Payments</PageTitle>
      <Suspense fallback={<p className="text-muted-foreground">Loading payments…</p>}>
        <Payments searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-(--bc-brown-faint)">
        Payment status is visible only to you and the sponsors. It is never posted in the channel;
        unpaid sponsors get a private Slack reminder on Wednesdays at 11am ET until you mark them
        paid.
      </p>
    </div>
  );
}

const statCard =
  "rounded-[18px] border-[3px] border-border bg-card px-6 py-4 shadow-chunky [&>dt]:text-xs [&>dt]:text-(--bc-brown-soft) [&>dd]:font-heading [&>dd]:text-[34px] [&>dd]:leading-tight";

async function Payments({ searchParams }: Pick<PageProps<"/admin/payments">, "searchParams">) {
  await requireOrganizer();
  const filter = parsePaymentFilter((await searchParams).filter);
  const { payments, thisWeekEventId } = await listPayments();
  const { collectedCents, outstandingCents } = paymentTotals(payments);
  const rows = filterPayments(payments, filter, thisWeekEventId);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <dl className="contents">
          <div className={statCard}>
            <dt>COLLECTED</dt>
            <dd className="text-destructive" data-testid="collected">
              {formatDollars(collectedCents)}
            </dd>
          </div>
          <div className={statCard}>
            <dt>OUTSTANDING</dt>
            <dd data-testid="outstanding">{formatDollars(outstandingCents)}</dd>
          </div>
        </dl>
        <div className="hidden flex-1 sm:block" />
        <nav aria-label="Filter payments" className="flex gap-1.5">
          {PAYMENT_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={paymentFilterHref(f.value)}
              aria-current={f.value === filter ? "page" : undefined}
              className={cn(
                "rounded-full border-2 border-border px-4 py-2 text-[13px] font-bold text-foreground no-underline hover:text-foreground",
                f.value === filter ? "bg-primary" : "bg-transparent",
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </div>

      <section className="overflow-hidden rounded-[18px] border-[3px] border-border bg-card shadow-chunky">
        {/* relative: keeps the sr-only header inside the scroller instead of widening the page */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[620px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col />
              <col className="w-[80px]" />
              <col className="w-[70px]" />
              <col className="w-[86px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-[11px] font-bold text-(--bc-brown-soft) uppercase">
                <th className="py-3 pl-[22px] font-bold">Thursday</th>
                <th className="py-3 pl-3 font-bold">Item</th>
                <th className="py-3 pl-3 font-bold">Sponsor</th>
                <th className="py-3 pl-3 font-bold">Amount</th>
                <th className="py-3 pl-3 font-bold">Paid</th>
                <th className="py-3 pr-[22px] pl-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const date = formatShortThursday(s.eventDate);
                const who = sponsorshipLabel(s);
                return (
                  <tr key={s.id} className="border-t border-border/20 align-middle">
                    <td className="py-3.5 pl-[22px]">{date}</td>
                    <td className="py-3.5 pl-3 break-words">{s.itemName}</td>
                    <td className="py-3.5 pl-3 break-words">{who}</td>
                    <td className="py-3.5 pl-3">{formatDollars(s.amountCents)}</td>
                    <td className="py-3.5 pl-3">
                      <PaidCheckbox
                        sponsorshipId={s.id}
                        paid={s.paid}
                        label={`Paid: ${who}, ${s.itemName}, ${date}`}
                      />
                    </td>
                    <td className="py-3.5 pr-[22px] pl-3">
                      <form action={removeSponsorship}>
                        <input type="hidden" name="sponsorshipId" value={s.id} />
                        <button
                          type="submit"
                          className="cursor-pointer text-xs underline"
                          aria-label={`Remove ${who}, ${s.itemName}, ${date}`}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="border-t border-border/20 p-[22px] text-sm text-(--bc-brown-soft)">
            Nothing here.
          </p>
        )}
      </section>
    </>
  );
}
