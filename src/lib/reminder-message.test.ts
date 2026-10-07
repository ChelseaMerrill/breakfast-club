import { describe, expect, it } from "vitest";
import { buildReminder, reminderMrkdwn, rsvpByText, slackSponsorText } from "./reminder-message";

const person = (name: string) => ({ teamName: null, sponsorName: null, members: [{ name }] });
const base = {
  date: new Date("2026-10-08T00:00:00Z"),
  orderingEnabled: true,
  item: { name: "Waffles", sponsorships: [person("Corbin")] },
  sponsorsNeeded: 1,
  amountCents: 3000,
  headcount: 6,
  rsvpDeadline: { weekday: 3, time: "17:00" },
};

describe("slackSponsorText", () => {
  it("matches docs/slack-integration.md", () => {
    expect(slackSponsorText([person("Corbin")], 1, 3000)).toBe("sponsored by Corbin");
    expect(slackSponsorText([person("Fred De Koker")], 2, 3000)).toBe(
      "sponsored by Fred De Koker (needs 1 more)",
    );
    expect(slackSponsorText([], 2, 3000)).toBe("needs 2 sponsor(s) ($30 each)");
  });
});

describe("rsvpByText", () => {
  it("spells out the day", () => {
    expect(rsvpByText({ weekday: 3, time: "17:00" })).toBe("Wednesday 5pm");
    expect(rsvpByText({ weekday: 2, time: "09:30" })).toBe("Tuesday 9:30am");
  });
});

describe("buildReminder / reminderMrkdwn", () => {
  it("renders the documented message", () => {
    expect(reminderMrkdwn(buildReminder(base))).toBe(
      [
        "*Breakfast Club — Thursday, Oct 8*",
        "On the menu:",
        "• Waffles — _sponsored by Corbin_",
        "Headcount so far: *6*",
        "RSVP by *Wednesday 5pm*.",
      ].join("\n"),
    );
  });

  it("says when the menu isn't posted and when ordering is off", () => {
    const msg = buildReminder({ ...base, item: null, orderingEnabled: false });
    expect(msg.menu).toEqual([]);
    expect(msg.notes).toEqual(["Menu coming soon!", "No orders needed this week — just RSVP!"]);
    expect(reminderMrkdwn(msg)).not.toContain("On the menu:");
  });

  it("never mentions payment status", () => {
    expect(reminderMrkdwn(buildReminder(base))).not.toMatch(/paid|due/i);
  });
});
