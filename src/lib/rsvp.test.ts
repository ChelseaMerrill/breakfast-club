import { describe, expect, it } from "vitest";
import { canRsvp, deadlineLabel, headcount, rsvpDeadlineFor } from "./rsvp";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const settings = { rsvpDeadlineWeekday: 3, rsvpDeadlineTime: "17:00" };

describe("rsvpDeadlineFor", () => {
  it("is the Wednesday before at 5pm New York time", () => {
    expect(
      rsvpDeadlineFor({ date: d("2026-10-08"), rsvpDeadline: null }, settings).toISOString(),
    ).toBe(
      "2026-10-07T21:00:00.000Z", // 5pm EDT
    );
    expect(
      rsvpDeadlineFor({ date: d("2026-11-05"), rsvpDeadline: null }, settings).toISOString(),
    ).toBe(
      "2026-11-04T22:00:00.000Z", // 5pm EST
    );
  });

  it("uses the event's own deadline when set", () => {
    const own = new Date("2026-10-08T12:00:00Z");
    expect(rsvpDeadlineFor({ date: d("2026-10-08"), rsvpDeadline: own }, settings)).toBe(own);
  });
});

describe("deadlineLabel", () => {
  it("formats like the design", () => {
    expect(deadlineLabel(settings)).toBe("Wed 5pm ET");
    expect(deadlineLabel({ rsvpDeadlineWeekday: 2, rsvpDeadlineTime: "09:30" }, "")).toBe(
      "Tue 9:30am",
    );
    expect(deadlineLabel({ rsvpDeadlineWeekday: 3, rsvpDeadlineTime: "12:00" }, "")).toBe(
      "Wed 12pm",
    );
  });
});

describe("canRsvp", () => {
  const event = { date: d("2026-10-08"), status: "SCHEDULED" as const };
  const deadline = new Date("2026-10-07T21:00:00Z");
  const today = d("2026-10-07");
  const before = new Date("2026-10-07T20:59:00Z");
  const after = new Date("2026-10-07T21:00:00Z");

  it("is open until the deadline for members", () => {
    expect(canRsvp(event, deadline, { now: before, today, isOrganizer: false })).toEqual({
      ok: true,
    });
    expect(canRsvp(event, deadline, { now: after, today, isOrganizer: false })).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("lets the organizer change RSVPs after the deadline", () => {
    expect(canRsvp(event, deadline, { now: after, today, isOrganizer: true })).toEqual({
      ok: true,
    });
  });

  it("is unavailable for skipped, cancelled, completed or past Thursdays", () => {
    for (const status of ["SKIPPED", "CANCELLED", "COMPLETED"] as const) {
      expect(
        canRsvp({ ...event, status }, deadline, { now: before, today, isOrganizer: true }),
      ).toEqual({
        ok: false,
        reason: "unavailable",
      });
    }
    expect(
      canRsvp(event, deadline, { now: before, today: d("2026-10-09"), isOrganizer: true }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("stays open while ordering is open on the day (walk-ins still RSVP)", () => {
    expect(
      canRsvp({ ...event, status: "ORDERING_OPEN" }, deadline, {
        now: before,
        today,
        isOrganizer: false,
      }),
    ).toEqual({ ok: true });
  });
});

describe("headcount", () => {
  it("is Yes RSVPs plus walk-ins and guests", () => {
    const orders = [
      { memberId: "priya", status: "COOKING" as const }, // RSVP'd yes: not a walk-in
      { memberId: "dana", status: "PLACED" as const }, // RSVP'd no but ordered: walk-in
      { memberId: null, status: "READY" as const }, // guest
      { memberId: "sam", status: "CANCELLED" as const }, // cancelled: ignored
    ];
    expect(headcount(["priya", "jane", "alex"], orders)).toEqual({ yes: 3, walkIns: 2, total: 5 });
  });

  it("is zero with nobody", () => {
    expect(headcount([], [])).toEqual({ yes: 0, walkIns: 0, total: 0 });
  });
});
