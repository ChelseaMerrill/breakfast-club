import "server-only";
import { db } from "@/lib/db";
import { syncThursdays } from "@/lib/events";
import { buildReminder } from "@/lib/reminder-message";
import { headcount } from "@/lib/rsvp";
import { nyToday } from "@/lib/thursdays";

export const SETTINGS_DEFAULTS = {
  rsvpDeadlineWeekday: 3,
  rsvpDeadlineTime: "17:00",
  sponsorshipAmountCents: 3000,
  remindersEnabled: true,
};

export async function getSettings() {
  const s = await db.appSettings.findUnique({ where: { id: 1 } });
  return { ...SETTINGS_DEFAULTS, ...s };
}

/**
 * What Tuesday's reminder would say right now, for this Thursday (the same one Home shows).
 * `skipped` when that Thursday has no breakfast, since no reminder is sent then.
 */
export async function reminderPreview(now = new Date()) {
  await syncThursdays(now);
  const [settings, event] = await Promise.all([
    getSettings(),
    db.breakfastEvent.findFirst({
      where: { date: { gte: nyToday(now) } },
      orderBy: { date: "asc" },
      include: {
        menuItems: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: {
            sponsorships: {
              orderBy: { createdAt: "asc" },
              include: { members: { include: { member: { select: { name: true } } } } },
            },
          },
        },
        rsvps: { where: { answer: "YES" }, select: { memberId: true } },
        orders: { select: { memberId: true, status: true } },
      },
    }),
  ]);
  if (!event) return null;
  if (event.status === "SKIPPED" || event.status === "CANCELLED") {
    return { skipped: true as const, date: event.date, reason: event.skipReason };
  }

  const item = event.menuItems[0];
  return {
    skipped: false as const,
    message: buildReminder({
      date: event.date,
      orderingEnabled: event.orderingEnabled,
      item: item && {
        name: item.name,
        sponsorships: item.sponsorships.map((s) => ({
          ...s,
          members: s.members.map((m) => m.member),
        })),
      },
      sponsorsNeeded: event.sponsorsNeeded,
      amountCents: settings.sponsorshipAmountCents,
      headcount: headcount(
        event.rsvps.map((r) => r.memberId),
        event.orders,
      ).total,
      rsvpDeadline: { weekday: settings.rsvpDeadlineWeekday, time: settings.rsvpDeadlineTime },
    }),
  };
}
