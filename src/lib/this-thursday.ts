import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import { canRsvp, deadlineLabel, headcount, rsvpDeadlineFor, type RsvpSettings } from "@/lib/rsvp";
import { nyToday } from "@/lib/thursdays";

const DEFAULT_SETTINGS: RsvpSettings = { rsvpDeadlineWeekday: 3, rsvpDeadlineTime: "17:00" };

export async function rsvpSettings(): Promise<RsvpSettings> {
  const s = await db.appSettings.findUnique({
    where: { id: 1 },
    select: { rsvpDeadlineWeekday: true, rsvpDeadlineTime: true },
  });
  return s ?? DEFAULT_SETTINGS;
}

/**
 * "This Thursday" for Home: the first Thursday from today (New York) onward, so it stays on
 * screen until midnight after breakfast (decision #33). Includes who's in/out and the headcount.
 */
export async function getThisThursday(memberId: string, isOrganizer: boolean, now = new Date()) {
  await syncThursdays(now);
  const today = nyToday(now);
  const [event, settings] = await Promise.all([
    db.breakfastEvent.findFirst({
      where: { date: { gte: today } },
      orderBy: { date: "asc" },
      include: {
        rsvps: {
          orderBy: { updatedAt: "asc" },
          include: { member: { select: { id: true, name: true } } },
        },
        orders: { select: { memberId: true, status: true } },
      },
    }),
    rsvpSettings(),
  ]);
  if (!event) return null;

  const yes = event.rsvps.filter((r) => r.answer === "YES");
  const no = event.rsvps.filter((r) => r.answer === "NO");
  const count = headcount(
    yes.map((r) => r.memberId),
    event.orders,
  );
  const deadline = rsvpDeadlineFor(event, settings);
  const nextBreakfast =
    event.status === "SKIPPED" || event.status === "CANCELLED"
      ? await db.breakfastEvent.findFirst({
          where: { date: { gt: event.date }, status: { notIn: ["SKIPPED", "CANCELLED"] } },
          orderBy: { date: "asc" },
          select: { date: true },
        })
      : null;

  return {
    id: event.id,
    date: event.date,
    status: event.status,
    skipReason: event.skipReason,
    nextBreakfastDate: nextBreakfast?.date ?? null,
    myAnswer: event.rsvps.find((r) => r.memberId === memberId)?.answer ?? null,
    yesNames: yes.map((r) => r.member.name),
    noNames: no.map((r) => r.member.name),
    headcount: count,
    deadlineText: deadlineLabel(settings),
    deadlineTextShort: deadlineLabel(settings, ""),
    rsvp: canRsvp(event, deadline, { now, today, isOrganizer }),
  };
}

export type ThisThursday = NonNullable<Awaited<ReturnType<typeof getThisThursday>>>;
