// Payments rules (docs/business-rules.md → Sponsorship & payments; design: organizer Payments).
// Pure functions and input schemas; the database side lives in src/lib/sponsorships.ts and
// src/app/(app)/admin/payments/actions.ts.
import { z } from "zod";

/** Filter pills on Payments, in design order. *Unpaid* is the default. */
export const PAYMENT_FILTERS = [
  { value: "unpaid", label: "Unpaid" },
  { value: "week", label: "This week" },
  { value: "all", label: "All" },
] as const;

export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]["value"];
export const DEFAULT_PAYMENT_FILTER: PaymentFilter = "unpaid";

/** `?filter=` from the URL; anything unknown falls back to *Unpaid*. */
export function parsePaymentFilter(value: string | string[] | undefined): PaymentFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return PAYMENT_FILTERS.some((f) => f.value === v) ? (v as PaymentFilter) : DEFAULT_PAYMENT_FILTER;
}

/** Link target for a filter pill (the default filter keeps a clean URL). */
export const paymentFilterHref = (filter: PaymentFilter) =>
  filter === DEFAULT_PAYMENT_FILTER ? "/admin/payments" : `/admin/payments?filter=${filter}`;

export type PaymentRow = {
  id: string;
  eventId: string;
  eventDate: Date;
  createdAt: Date;
  amountCents: number;
  paid: boolean;
};

/**
 * The rows a filter shows. *This week* is the Thursday Home shows (the first one from today in
 * New York); `thisWeekEventId` is null when there is none.
 */
export function filterPayments<T extends PaymentRow>(
  rows: T[],
  filter: PaymentFilter,
  thisWeekEventId: string | null,
): T[] {
  switch (filter) {
    case "unpaid":
      return rows.filter((r) => !r.paid);
    case "week":
      return rows.filter((r) => r.eventId === thisWeekEventId);
    case "all":
      return rows;
  }
}

/** Thursday ascending, then the order they signed up. */
export const sortPayments = <T extends PaymentRow>(rows: T[]): T[] =>
  [...rows].sort(
    (a, b) =>
      a.eventDate.getTime() - b.eventDate.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

/**
 * *Collected* and *Outstanding*, like the design: over every sponsorship, whatever the filter.
 * Each sponsorship counts its own `amountCents` (copied from settings when it was created).
 */
export function paymentTotals(rows: Pick<PaymentRow, "amountCents" | "paid">[]) {
  let collectedCents = 0;
  let outstandingCents = 0;
  for (const r of rows) {
    if (r.paid) collectedCents += r.amountCents;
    else outstandingCents += r.amountCents;
  }
  return { collectedCents, outstandingCents };
}

/**
 * The update for marking a sponsorship Paid / unpaid, or null if it is already that way (so a
 * repeat click keeps the original `paidAt`).
 */
export function paidUpdate(current: { paid: boolean }, paid: boolean, now: Date = new Date()) {
  if (current.paid === paid) return null;
  return { paid, paidAt: paid ? now : null };
}

/** The Paid checkbox's input: which sponsorship, and the state the organizer set it to. */
export const setPaidInput = z.object({
  sponsorshipId: z.string().min(1).max(64),
  paid: z.enum(["true", "false"]).transform((v) => v === "true"),
});
