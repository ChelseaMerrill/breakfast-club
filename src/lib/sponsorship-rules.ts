// Menu & sponsorship rules (docs/business-rules.md → Menu, Sponsorship & payments, Permissions).
// Pure functions and input schemas; the database side lives in src/app/(app)/schedule/actions.ts
// and src/lib/sponsorships.ts.
import { z } from "zod";
import type { EventStatus } from "@/generated/prisma/enums";
import { isUpcoming } from "@/lib/event-lifecycle";

export type MenuEvent = { date: Date; status: EventStatus };

/** Statuses of a Thursday that is still going ahead (not skipped, cancelled or completed). */
const GOING_AHEAD: EventStatus[] = ["SCHEDULED", "ORDERING_OPEN", "ORDERING_CLOSED"];

/** The organizer can edit the menu item, sponsors needed and sponsors of an upcoming Thursday that is going ahead. */
export const canEditMenu = (e: MenuEvent, today: Date) =>
  isUpcoming(e, today) && GOING_AHEAD.includes(e.status);

export const FULLY_SPONSORED = "That item is already fully sponsored.";

export type SponsorCheck = {
  event: MenuEvent & { sponsorsNeeded: number };
  hasMenuItem: boolean;
  sponsorshipCount: number;
};

/**
 * Why a new Sponsorship can't be added right now, or null if it can. Applies to members
 * (Sponsor this) and to the organizer's "Add sponsor by name" alike.
 */
export function sponsorBlockReason(
  { event, hasMenuItem, sponsorshipCount }: SponsorCheck,
  today: Date,
): string | null {
  if (!isUpcoming(event, today)) return "That Thursday has passed.";
  if (event.status === "SKIPPED") return "There's no breakfast that Thursday.";
  if (!GOING_AHEAD.includes(event.status)) return "That Thursday isn't going ahead.";
  if (!hasMenuItem) return "That Thursday has no menu item yet.";
  if (sponsorshipCount >= event.sponsorsNeeded) return FULLY_SPONSORED;
  return null;
}

/** Whether to show *Sponsor this* (hidden once the sponsors needed are filled). */
export const canSponsor = (check: SponsorCheck, today: Date) =>
  sponsorBlockReason(check, today) === null;

/** Sponsors needed can't go below 1, or below the sponsorships already on the item. */
export const minSponsorsNeeded = (sponsorshipCount: number) => Math.max(1, sponsorshipCount);
export const MAX_SPONSORS_NEEDED = 10;

export function nextSponsorsNeeded(current: number, delta: 1 | -1, sponsorshipCount: number) {
  return Math.min(
    MAX_SPONSORS_NEEDED,
    Math.max(minSponsorsNeeded(sponsorshipCount), current + delta),
  );
}

export type RemovableSponsorship = { paid: boolean; memberIds: string[]; eventDate: Date };

/**
 * The organizer can remove any sponsorship. A member can remove one they're on until it's
 * marked Paid or the Thursday has passed.
 */
export function canRemoveSponsorship(
  s: RemovableSponsorship,
  member: { id: string; isOrganizer: boolean },
  today: Date,
): boolean {
  if (member.isOrganizer) return true;
  return s.memberIds.includes(member.id) && !s.paid && isUpcoming({ date: s.eventDate }, today);
}

/** The member's own view of a sponsorship: removable only while unpaid and upcoming. */
export const canRemoveOwnSponsorship = (s: Omit<RemovableSponsorship, "memberIds">, today: Date) =>
  !s.paid && isUpcoming({ date: s.eventDate }, today);

// ---- Input validation (server actions parse FormData with these) ----

const id = z.string().min(1).max(64);
const name = (label: string) =>
  z.string().trim().min(1, `Enter a ${label}.`).max(60, `Keep the ${label} under 60 characters.`);

/** Sponsor this: the member who presses it sponsors the Thursday's item (open-questions #52). */
export const sponsorInput = z.object({ eventId: id });
export type SponsorInput = z.infer<typeof sponsorInput>;

/** The organizer's inline menu item; an empty name removes the item (if nothing depends on it). */
export const menuItemInput = z.object({
  eventId: id,
  name: z.string().trim().max(60, "Keep the menu item under 60 characters."),
});

export const sponsorsNeededInput = z.object({
  eventId: id,
  delta: z.enum(["1", "-1"]).transform((d) => (d === "1" ? 1 : -1) as 1 | -1),
});

export const sponsorByNameInput = z.object({ eventId: id, sponsorName: name("name") });

export const sponsorshipIdInput = z.object({ sponsorshipId: id });

/** First zod issue as a user-facing message. */
export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Invalid input.";
