"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/dal";
import { canRsvp, rsvpDeadlineFor } from "@/lib/rsvp";
import { rsvpSettings } from "@/lib/this-thursday";
import { nyToday } from "@/lib/thursdays";

const input = z.object({
  eventId: z.string().min(1).max(64),
  answer: z.enum(["YES", "NO"]),
});

export type RsvpResult = { ok: true } | { ok: false; error: string };

/** A member's own Yes/No for a Thursday (one per member; changing overwrites). */
export async function setRsvp(formData: FormData): Promise<RsvpResult> {
  const member = await getCurrentMember();
  const parsed = input.safeParse({
    eventId: formData.get("eventId"),
    answer: formData.get("answer"),
  });
  if (!parsed.success)
    return { ok: false, error: "That RSVP didn't make sense. Please try again." };

  const now = new Date();
  const [event, settings] = await Promise.all([
    db.breakfastEvent.findUnique({
      where: { id: parsed.data.eventId },
      select: { id: true, date: true, status: true, rsvpDeadline: true },
    }),
    rsvpSettings(),
  ]);
  if (!event) return { ok: false, error: "That Thursday doesn't exist anymore." };

  const check = canRsvp(event, rsvpDeadlineFor(event, settings), {
    now,
    today: nyToday(now),
    isOrganizer: member.isOrganizer,
  });
  if (!check.ok) {
    return {
      ok: false,
      error:
        check.reason === "closed"
          ? "RSVPs are closed for this Thursday. You can still order as a walk-in."
          : "There's no breakfast to RSVP for that Thursday.",
    };
  }

  await db.rsvp.upsert({
    where: { eventId_memberId: { eventId: event.id, memberId: member.id } },
    update: { answer: parsed.data.answer },
    create: { eventId: event.id, memberId: member.id, answer: parsed.data.answer },
  });
  revalidatePath("/");
  revalidatePath("/schedule");
  return { ok: true };
}
