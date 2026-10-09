import { describe, expect, it } from "vitest";
import { decidePaymentReminder, groupBySponsor, paymentReminderMessage } from "./payment-reminder";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const event = { paymentReminderSentAt: null };

describe("decidePaymentReminder", () => {
  it("sends on Wednesday at or after 11am New York time (EDT and EST)", () => {
    // Wed Oct 7 2026 11:00 EDT = 15:00 UTC
    expect(decidePaymentReminder({ now: new Date("2026-10-07T15:00:00Z"), event })).toEqual({
      send: true,
    });
    // Wed Nov 4 2026 11:00 EST = 16:00 UTC; 15:30 UTC is still 10:30 there
    expect(decidePaymentReminder({ now: new Date("2026-11-04T15:30:00Z"), event })).toEqual({
      send: false,
      reason: "too-early",
    });
    expect(decidePaymentReminder({ now: new Date("2026-11-04T16:05:00Z"), event }).send).toBe(true);
  });

  it("skips other days, before 11, once sent, and with no Thursday", () => {
    expect(decidePaymentReminder({ now: new Date("2026-10-06T16:00:00Z"), event })).toEqual({
      send: false,
      reason: "not-reminder-day",
    });
    expect(decidePaymentReminder({ now: new Date("2026-10-07T14:59:00Z"), event })).toEqual({
      send: false,
      reason: "too-early",
    });
    expect(
      decidePaymentReminder({
        now: new Date("2026-10-07T15:30:00Z"),
        event: { paymentReminderSentAt: new Date("2026-10-07T15:00:00Z") },
      }),
    ).toEqual({ send: false, reason: "already-sent" });
    expect(decidePaymentReminder({ now: new Date("2026-10-07T15:30:00Z"), event: null })).toEqual({
      send: false,
      reason: "no-thursday",
    });
  });
});

describe("groupBySponsor", () => {
  it("one entry per Slack member, oldest first; typed names and seed members skipped", () => {
    const grouped = groupBySponsor([
      {
        itemName: "Quiche",
        eventDate: d("2026-10-15"),
        amountCents: 3000,
        members: [{ slackUserId: "U1" }],
      },
      {
        itemName: "Waffles",
        eventDate: d("2026-10-08"),
        amountCents: 3000,
        members: [{ slackUserId: "U1" }],
      },
      {
        itemName: "Waffles",
        eventDate: d("2026-10-08"),
        amountCents: 3000,
        members: [{ slackUserId: "U2" }],
      },
      { itemName: "Bagels", eventDate: d("2026-10-08"), amountCents: 3000, members: [] }, // typed name
      {
        itemName: "Lox",
        eventDate: d("2026-10-08"),
        amountCents: 3000,
        members: [{ slackUserId: "SEED_X" }],
      },
    ]);
    expect([...grouped.keys()]).toEqual(["U1", "U2"]);
    expect(grouped.get("U1")!.map((l) => l.itemName)).toEqual(["Waffles", "Quiche"]);
  });
});

describe("paymentReminderMessage", () => {
  it("lists what's owed and how to pay", () => {
    const one = paymentReminderMessage([
      { itemName: "Waffles", eventDate: d("2026-10-08"), amountCents: 3000 },
    ]);
    expect(one.text).toContain("Please give Chelsea $30.");
    expect(one.text).toContain("• Waffles (Thu, Oct 8) — $30");
    expect(one.text).toContain("Pay with cash or Venmo @Chelsea-Merrill-1.");
    expect(JSON.stringify(one.blocks)).toContain("https://venmo.com/u/Chelsea-Merrill-1");
  });

  it("totals several sponsorships", () => {
    const two = paymentReminderMessage([
      { itemName: "Waffles", eventDate: d("2026-10-08"), amountCents: 3000 },
      { itemName: "Quiche", eventDate: d("2026-10-15"), amountCents: 3000 },
    ]);
    expect(two.text).toContain("Please give Chelsea $60 in total.");
  });
});
