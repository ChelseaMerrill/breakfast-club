import { describe, expect, it } from "vitest";
import { clockOverride, decideReminder, nyWeekday, type ReminderEvent } from "./reminder-decision";

const settings = { remindersEnabled: true, reminderWeekday: 2, reminderTime: "10:00" };
const event: ReminderEvent = { status: "SCHEDULED", reminderSentAt: null };
const decide = (now: string, overrides: Partial<Parameters<typeof decideReminder>[0]> = {}) =>
  decideReminder({ now: new Date(now), settings, event, ...overrides });

describe("decideReminder", () => {
  it("summer (EDT): the 14:00 UTC cron is 10:00 in New York and posts", () => {
    expect(decide("2026-10-06T14:00:00Z")).toEqual({ send: true });
    expect(decide("2026-10-06T13:59:00Z")).toEqual({ send: false, reason: "too-early" });
  });

  it("winter (EST): the 14:00 UTC cron is 9:00 and waits; the 15:00 one posts", () => {
    expect(decide("2026-11-03T14:00:00Z")).toEqual({ send: false, reason: "too-early" });
    expect(decide("2026-11-03T15:00:00Z")).toEqual({ send: true });
  });

  it("the second cron is skipped once the reminder went out", () => {
    expect(
      decide("2026-10-06T15:00:00Z", {
        event: { ...event, reminderSentAt: new Date("2026-10-06T14:00:05Z") },
      }),
    ).toEqual({ send: false, reason: "already-sent" });
  });

  it("only posts on the reminder weekday in New York, not UTC", () => {
    expect(decide("2026-10-07T15:00:00Z")).toEqual({ send: false, reason: "not-reminder-day" }); // Wed
    expect(decide("2026-10-06T03:30:00Z")).toEqual({ send: false, reason: "not-reminder-day" }); // Mon 11:30pm NY
    expect(decide("2026-10-07T02:00:00Z")).toEqual({ send: true }); // Tue 10pm NY, Wed in UTC
  });

  it("follows AppSettings.reminderTime", () => {
    const later = { ...settings, reminderTime: "10:30" };
    expect(decide("2026-10-06T14:00:00Z", { settings: later })).toEqual({
      send: false,
      reason: "too-early",
    });
    expect(decide("2026-10-06T14:30:00Z", { settings: later })).toEqual({ send: true });
  });

  it("skips when reminders are off, there's no Thursday, or it's skipped/cancelled", () => {
    const at = "2026-10-06T14:30:00Z";
    expect(decide(at, { settings: { ...settings, remindersEnabled: false } })).toEqual({
      send: false,
      reason: "reminders-off",
    });
    expect(decide(at, { event: null })).toEqual({ send: false, reason: "no-thursday" });
    for (const status of ["SKIPPED", "CANCELLED"]) {
      expect(decide(at, { event: { ...event, status } })).toEqual({
        send: false,
        reason: "thursday-skipped",
      });
    }
  });
});

describe("nyWeekday", () => {
  it("uses New York's calendar", () => {
    expect(nyWeekday(new Date("2026-10-06T14:00:00Z"))).toBe(2);
    expect(nyWeekday(new Date("2026-10-07T03:00:00Z"))).toBe(2);
    expect(nyWeekday(new Date("2026-10-07T05:00:00Z"))).toBe(3);
  });
});

describe("clockOverride", () => {
  const at = "2026-10-06T14:30:00Z";
  it("works only under next dev", () => {
    expect(clockOverride(at, "development")).toEqual(new Date(at));
    expect(clockOverride(at, "production")).toBeNull();
    expect(clockOverride(at, "test")).toBeNull();
    expect(clockOverride(at, undefined)).toBeNull();
  });

  it("ignores missing or invalid values", () => {
    expect(clockOverride(null, "development")).toBeNull();
    expect(clockOverride("next tuesday", "development")).toBeNull();
  });
});
