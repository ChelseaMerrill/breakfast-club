export const TIME_ZONE = "America/New_York";

const THURSDAY = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's calendar date in New York, as a UTC-midnight Date (the shape Prisma uses for @db.Date). */
export function nyToday(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
  return new Date(`${parts}T00:00:00Z`);
}

/** The next `count` Thursdays, starting today if today is a Thursday in New York. */
export function upcomingThursdays(count: number, now: Date = new Date()): Date[] {
  const today = nyToday(now);
  const daysUntil = (THURSDAY - today.getUTCDay() + 7) % 7;
  const first = today.getTime() + daysUntil * DAY_MS;
  return Array.from({ length: count }, (_, i) => new Date(first + i * 7 * DAY_MS));
}

/** "Thursday, Oct 8" for a @db.Date value. */
export function formatThursday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** "Thu, Oct 8" for a @db.Date value (Schedule and Thursdays cards). */
export function formatShortThursday(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** New York's UTC offset in minutes at an instant (e.g. -240 in summer, -300 in winter). */
function nyOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT-4", "GMT-5", "GMT"
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/** The instant of a New York wall-clock time ("17:00") on a calendar date (a @db.Date value). */
export function nyWallTimeToUtc(date: Date, hhmm: string): Date {
  const [h, min] = hhmm.split(":").map(Number);
  const wall = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h, min);
  let utc = wall - nyOffsetMinutes(new Date(wall)) * 60_000;
  // Near a DST change the offset at the real instant can differ from the first guess.
  const corrected = wall - nyOffsetMinutes(new Date(utc)) * 60_000;
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}
