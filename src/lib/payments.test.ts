import { describe, expect, it } from "vitest";
import {
  filterPayments,
  paidUpdate,
  parsePaymentFilter,
  paymentFilterHref,
  paymentTotals,
  setPaidInput,
  sortPayments,
} from "./payments";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const row = (id: string, eventId: string, date: string, paid: boolean, amountCents = 3000) => ({
  id,
  eventId,
  eventDate: d(date),
  createdAt: new Date(`${date}T12:00:00Z`),
  amountCents,
  paid,
});

const rows = [
  row("a", "oct8", "2026-10-08", false),
  row("b", "oct8", "2026-10-08", true),
  row("c", "oct1", "2026-10-01", false, 2500), // past, still unpaid
  row("d", "oct15", "2026-10-15", true),
];

describe("parsePaymentFilter", () => {
  it("defaults to Unpaid and accepts the three filters", () => {
    expect(parsePaymentFilter(undefined)).toBe("unpaid");
    expect(parsePaymentFilter("week")).toBe("week");
    expect(parsePaymentFilter("all")).toBe("all");
    expect(parsePaymentFilter(["all", "week"])).toBe("all");
    expect(parsePaymentFilter("paid")).toBe("unpaid");
  });

  it("links the default filter without a query string", () => {
    expect(paymentFilterHref("unpaid")).toBe("/admin/payments");
    expect(paymentFilterHref("week")).toBe("/admin/payments?filter=week");
  });
});

describe("filterPayments", () => {
  it("Unpaid shows every unpaid sponsorship, past ones included", () => {
    expect(filterPayments(rows, "unpaid", "oct8").map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("This week shows the Thursday Home shows, paid or not", () => {
    expect(filterPayments(rows, "week", "oct8").map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterPayments(rows, "week", null)).toEqual([]);
  });

  it("All shows everything", () => {
    expect(filterPayments(rows, "all", "oct8")).toHaveLength(4);
  });
});

describe("sortPayments", () => {
  it("orders by Thursday, then sign-up time", () => {
    const early = { ...row("e", "oct8", "2026-10-08", false), createdAt: d("2026-09-01") };
    expect(sortPayments([...rows, early]).map((r) => r.id)).toEqual(["c", "e", "a", "b", "d"]);
  });
});

describe("paymentTotals", () => {
  it("sums each sponsorship's own amount into Collected or Outstanding", () => {
    expect(paymentTotals(rows)).toEqual({ collectedCents: 6000, outstandingCents: 5500 });
    expect(paymentTotals([])).toEqual({ collectedCents: 0, outstandingCents: 0 });
  });
});

describe("paidUpdate", () => {
  const now = new Date("2026-10-08T14:00:00Z");

  it("marking Paid records paidAt; unchecking clears it", () => {
    expect(paidUpdate({ paid: false }, true, now)).toEqual({ paid: true, paidAt: now });
    expect(paidUpdate({ paid: true }, false, now)).toEqual({ paid: false, paidAt: null });
  });

  it("does nothing when it's already that way, so paidAt is kept", () => {
    expect(paidUpdate({ paid: true }, true, now)).toBeNull();
    expect(paidUpdate({ paid: false }, false, now)).toBeNull();
  });
});

describe("setPaidInput", () => {
  it("parses the checkbox's form fields", () => {
    expect(setPaidInput.parse({ sponsorshipId: "s1", paid: "true" })).toEqual({
      sponsorshipId: "s1",
      paid: true,
    });
    expect(setPaidInput.parse({ sponsorshipId: "s1", paid: "false" }).paid).toBe(false);
    expect(setPaidInput.safeParse({ sponsorshipId: "s1", paid: "yes" }).success).toBe(false);
    expect(setPaidInput.safeParse({ sponsorshipId: "", paid: "true" }).success).toBe(false);
  });
});
