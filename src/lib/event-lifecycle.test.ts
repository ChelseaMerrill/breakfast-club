import { describe, expect, it } from "vitest";
import {
  canRestore,
  canSkip,
  missingThursdays,
  nextThursdayAfter,
  rolloverUpdate,
} from "./event-lifecycle";
import { sponsorSummary, sponsorshipLabel } from "./sponsorship-display";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-08"); // a Thursday
const now = new Date("2026-10-09T04:30:00Z");

describe("missingThursdays / nextThursdayAfter", () => {
  it("returns only the Thursdays that don't exist yet", () => {
    const wanted = [d("2026-10-08"), d("2026-10-15"), d("2026-10-22")];
    expect(missingThursdays([d("2026-10-15")], wanted)).toEqual([d("2026-10-08"), d("2026-10-22")]);
  });

  it("adds one week", () => {
    expect(nextThursdayAfter(d("2026-10-29"))).toEqual(d("2026-11-05"));
  });
});

describe("rolloverUpdate", () => {
  it("leaves today and future Thursdays alone", () => {
    expect(rolloverUpdate({ date: today, status: "ORDERING_OPEN" }, today, now)).toBeNull();
    expect(rolloverUpdate({ date: d("2026-10-15"), status: "SCHEDULED" }, today, now)).toBeNull();
  });

  it("completes past Thursdays", () => {
    expect(rolloverUpdate({ date: d("2026-10-01"), status: "SCHEDULED" }, today, now)).toEqual({
      status: "COMPLETED",
    });
    expect(
      rolloverUpdate({ date: d("2026-10-01"), status: "ORDERING_CLOSED" }, today, now),
    ).toEqual({ status: "COMPLETED" });
  });

  it("auto-closes ordering that was left open", () => {
    expect(rolloverUpdate({ date: d("2026-10-01"), status: "ORDERING_OPEN" }, today, now)).toEqual({
      status: "COMPLETED",
      orderingClosedAt: now,
      orderingAutoClosed: true,
    });
  });

  it("never touches skipped, cancelled or completed weeks", () => {
    for (const status of ["SKIPPED", "CANCELLED", "COMPLETED"] as const) {
      expect(rolloverUpdate({ date: d("2026-10-01"), status }, today, now)).toBeNull();
    }
  });
});

describe("canSkip / canRestore", () => {
  it("allows skipping only upcoming scheduled weeks", () => {
    expect(canSkip({ date: today, status: "SCHEDULED" }, today)).toBe(true);
    expect(canSkip({ date: today, status: "ORDERING_OPEN" }, today)).toBe(false);
    expect(canSkip({ date: d("2026-10-01"), status: "SCHEDULED" }, today)).toBe(false);
  });

  it("allows restoring only upcoming skipped weeks", () => {
    expect(canRestore({ date: d("2026-11-26"), status: "SKIPPED" }, today)).toBe(true);
    expect(canRestore({ date: d("2026-10-01"), status: "SKIPPED" }, today)).toBe(false);
    expect(canRestore({ date: d("2026-11-26"), status: "SCHEDULED" }, today)).toBe(false);
  });
});

describe("sponsor wording", () => {
  const person = (name: string) => ({ teamName: null, sponsorName: null, members: [{ name }] });

  it("labels people, pairs, teams and typed names", () => {
    expect(sponsorshipLabel(person("Corbin"))).toBe("Corbin");
    expect(
      sponsorshipLabel({
        teamName: null,
        sponsorName: null,
        members: [{ name: "Jordan Reyes" }, { name: "Jane Doe" }],
      }),
    ).toBe("Jordan Reyes & Jane Doe");
    expect(sponsorshipLabel({ teamName: "Delivery team", sponsorName: null, members: [] })).toBe(
      "Delivery team",
    );
    expect(sponsorshipLabel({ teamName: null, sponsorName: "Client – Acme", members: [] })).toBe(
      "Client – Acme",
    );
  });

  it("matches the design's three cases", () => {
    expect(sponsorSummary([person("Corbin")], 1, 3000)).toEqual({
      text: "Sponsored by Corbin",
      fullySponsored: true,
      needed: 0,
    });
    expect(sponsorSummary([person("Joshua Cantor-Stone")], 2, 3000).text).toBe(
      "Sponsored by Joshua Cantor-Stone · needs 1 more",
    );
    expect(sponsorSummary([], 1, 3000).text).toBe("Needs 1 sponsor ($30 each)");
    expect(sponsorSummary([], 2, 3000).text).toBe("Needs 2 sponsors ($30 each)");
  });
});
