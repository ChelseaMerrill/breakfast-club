import { describe, expect, it } from "vitest";
import {
  FULLY_SPONSORED,
  MAX_SPONSORS_NEEDED,
  canEditMenu,
  canRemoveOwnSponsorship,
  canRemoveSponsorship,
  canSponsor,
  menuItemInput,
  nextSponsorsNeeded,
  sponsorBlockReason,
  sponsorByNameInput,
  sponsorInput,
  sponsorsNeededInput,
} from "./sponsorship-rules";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-08"); // a Thursday
const upcoming = { date: d("2026-10-15"), status: "SCHEDULED" as const, sponsorsNeeded: 1 };
const check = (over: Partial<Parameters<typeof sponsorBlockReason>[0]> = {}) => ({
  event: upcoming,
  hasMenuItem: true,
  sponsorshipCount: 0,
  ...over,
});

describe("canEditMenu", () => {
  it("allows upcoming Thursdays that are going ahead, including today", () => {
    expect(canEditMenu(upcoming, today)).toBe(true);
    expect(canEditMenu({ date: today, status: "ORDERING_OPEN" }, today)).toBe(true);
  });

  it("refuses past, skipped, cancelled and completed Thursdays", () => {
    expect(canEditMenu({ date: d("2026-10-01"), status: "SCHEDULED" }, today)).toBe(false);
    expect(canEditMenu({ ...upcoming, status: "SKIPPED" }, today)).toBe(false);
    expect(canEditMenu({ ...upcoming, status: "CANCELLED" }, today)).toBe(false);
    expect(canEditMenu({ ...upcoming, status: "COMPLETED" }, today)).toBe(false);
  });
});

describe("sponsorBlockReason / canSponsor", () => {
  it("lets anyone sponsor an upcoming item that still needs sponsors", () => {
    expect(sponsorBlockReason(check(), today)).toBeNull();
    expect(canSponsor(check({ event: { ...upcoming, date: today } }), today)).toBe(true);
    expect(
      canSponsor(check({ event: { ...upcoming, sponsorsNeeded: 2 }, sponsorshipCount: 1 }), today),
    ).toBe(true);
  });

  it("hides Sponsor this once the sponsors needed are filled (the cap)", () => {
    expect(sponsorBlockReason(check({ sponsorshipCount: 1 }), today)).toBe(FULLY_SPONSORED);
    expect(
      canSponsor(check({ event: { ...upcoming, sponsorsNeeded: 2 }, sponsorshipCount: 2 }), today),
    ).toBe(false);
    // Lowered below the existing count (shouldn't happen, but still capped).
    expect(canSponsor(check({ sponsorshipCount: 3 }), today)).toBe(false);
  });

  it("needs a menu item", () => {
    expect(sponsorBlockReason(check({ hasMenuItem: false }), today)).toMatch(/no menu item/);
  });

  it("refuses skipped, cancelled, completed and past Thursdays", () => {
    expect(sponsorBlockReason(check({ event: { ...upcoming, status: "SKIPPED" } }), today)).toMatch(
      /no breakfast/,
    );
    expect(canSponsor(check({ event: { ...upcoming, status: "CANCELLED" } }), today)).toBe(false);
    expect(canSponsor(check({ event: { ...upcoming, status: "COMPLETED" } }), today)).toBe(false);
    expect(
      sponsorBlockReason(check({ event: { ...upcoming, date: d("2026-10-01") } }), today),
    ).toBe("That Thursday has passed.");
  });
});

describe("nextSponsorsNeeded", () => {
  it("steps up and down by one", () => {
    expect(nextSponsorsNeeded(1, 1, 0)).toBe(2);
    expect(nextSponsorsNeeded(3, -1, 0)).toBe(2);
  });

  it("never goes below 1", () => {
    expect(nextSponsorsNeeded(1, -1, 0)).toBe(1);
  });

  it("never goes below the sponsorships already on the item", () => {
    expect(nextSponsorsNeeded(2, -1, 2)).toBe(2);
    expect(nextSponsorsNeeded(3, -1, 2)).toBe(2);
  });

  it("stops at the maximum", () => {
    expect(nextSponsorsNeeded(MAX_SPONSORS_NEEDED, 1, 0)).toBe(MAX_SPONSORS_NEEDED);
  });
});

describe("canRemoveSponsorship", () => {
  const me = { id: "jordan", isOrganizer: false };
  const chelsea = { id: "chelsea", isOrganizer: true };
  const mine = { paid: false, memberIds: ["jordan", "jane"], eventDate: d("2026-10-15") };

  it("lets a member remove an unpaid, upcoming sponsorship they're on", () => {
    expect(canRemoveSponsorship(mine, me, today)).toBe(true);
    expect(canRemoveSponsorship(mine, { id: "jane", isOrganizer: false }, today)).toBe(true);
    expect(canRemoveSponsorship({ ...mine, eventDate: today }, me, today)).toBe(true);
  });

  it("refuses someone else's sponsorship", () => {
    expect(canRemoveSponsorship(mine, { id: "sam", isOrganizer: false }, today)).toBe(false);
  });

  it("refuses once paid or once the Thursday has passed", () => {
    expect(canRemoveSponsorship({ ...mine, paid: true }, me, today)).toBe(false);
    expect(canRemoveSponsorship({ ...mine, eventDate: d("2026-10-01") }, me, today)).toBe(false);
  });

  it("lets the organizer remove any sponsorship", () => {
    expect(canRemoveSponsorship({ ...mine, memberIds: [], paid: true }, chelsea, today)).toBe(true);
  });

  it("canRemoveOwnSponsorship matches the member rule for their own list", () => {
    expect(canRemoveOwnSponsorship(mine, today)).toBe(true);
    expect(canRemoveOwnSponsorship({ ...mine, paid: true }, today)).toBe(false);
    expect(canRemoveOwnSponsorship({ ...mine, eventDate: d("2026-10-01") }, today)).toBe(false);
  });
});

describe("input validation", () => {
  it("Sponsor this only needs the Thursday: the sponsor is whoever pressed it", () => {
    expect(sponsorInput.parse({ eventId: "e1" })).toEqual({ eventId: "e1" });
    // Old modes and extra fields are ignored, never trusted (no partner or team any more).
    expect(sponsorInput.parse({ eventId: "e1", mode: "two", partnerId: "m2" })).toEqual({
      eventId: "e1",
    });
    expect(sponsorInput.safeParse({}).success).toBe(false);
    expect(sponsorInput.safeParse({ eventId: "" }).success).toBe(false);
  });

  it("trims menu item names and allows empty (remove)", () => {
    expect(menuItemInput.parse({ eventId: "e1", name: " Waffles " }).name).toBe("Waffles");
    expect(menuItemInput.parse({ eventId: "e1", name: "  " }).name).toBe("");
    expect(menuItemInput.safeParse({ eventId: "e1", name: "x".repeat(61) }).success).toBe(false);
  });

  it("requires a sponsor name for Add sponsor by name", () => {
    expect(sponsorByNameInput.parse({ eventId: "e1", sponsorName: " Fred " }).sponsorName).toBe(
      "Fred",
    );
    expect(sponsorByNameInput.safeParse({ eventId: "e1", sponsorName: "" }).success).toBe(false);
  });

  it("only accepts −1 / +1 for sponsors needed", () => {
    expect(sponsorsNeededInput.parse({ eventId: "e1", delta: "1" }).delta).toBe(1);
    expect(sponsorsNeededInput.parse({ eventId: "e1", delta: "-1" }).delta).toBe(-1);
    expect(sponsorsNeededInput.safeParse({ eventId: "e1", delta: "5" }).success).toBe(false);
  });
});
