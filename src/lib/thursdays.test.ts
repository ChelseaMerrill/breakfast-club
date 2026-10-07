import { describe, expect, it } from "vitest";
import { formatShortThursday, formatThursday, nyToday, upcomingThursdays } from "./thursdays";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("nyToday", () => {
  it("uses the New York calendar date, not UTC", () => {
    // 02:30 UTC on Fri Oct 9 is still 10:30pm Thu Oct 8 in New York (EDT).
    expect(iso(nyToday(new Date("2026-10-09T02:30:00Z")))).toBe("2026-10-08");
  });
});

describe("upcomingThursdays", () => {
  it("starts with this week's Thursday when today is earlier in the week", () => {
    const wednesday = new Date("2026-10-07T18:00:00Z");
    expect(upcomingThursdays(2, wednesday).map(iso)).toEqual(["2026-10-08", "2026-10-15"]);
  });

  it("includes today when today is Thursday in New York", () => {
    const lateThursdayNy = new Date("2026-10-09T02:30:00Z");
    expect(iso(upcomingThursdays(1, lateThursdayNy)[0])).toBe("2026-10-08");
  });

  it("skips to next week once Thursday has passed in New York", () => {
    const friday = new Date("2026-10-09T15:00:00Z");
    expect(iso(upcomingThursdays(1, friday)[0])).toBe("2026-10-15");
  });

  it("stays on Thursdays across the DST change", () => {
    const dates = upcomingThursdays(8, new Date("2026-10-20T12:00:00Z"));
    expect(dates.every((d) => d.getUTCDay() === 4)).toBe(true);
    expect(dates.map(iso)).toContain("2026-11-05"); // first Thursday after clocks change on Nov 1
  });
});

describe("formatThursday", () => {
  it("formats like the design", () => {
    expect(formatThursday(new Date("2026-10-08T00:00:00Z"))).toBe("Thursday, Oct 8");
  });
});

describe("formatShortThursday", () => {
  it("formats like the design's cards", () => {
    expect(formatShortThursday(new Date("2026-10-08T00:00:00Z"))).toBe("Thu, Oct 8");
  });
});
