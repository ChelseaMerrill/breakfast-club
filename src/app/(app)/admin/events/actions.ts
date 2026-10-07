"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/dal";
import { canRestore, canSkip, canToggleOrdering } from "@/lib/event-lifecycle";
import { addNextThursday as addNext } from "@/lib/events";
import { nyToday } from "@/lib/thursdays";

// Organizer-only mutations for /admin/events. Each re-checks the session (docs: never trust the
// proxy alone) and the event's current state, so a stale page can't skip a week that has started.

const eventId = z.string().min(1).max(64);
const skipInput = z.object({
  eventId,
  reason: z.string().trim().max(80).optional(),
});

function refresh() {
  revalidatePath("/admin/events");
  revalidatePath("/schedule");
  revalidatePath("/");
}

async function loadEvent(id: string) {
  return db.breakfastEvent.findUniqueOrThrow({
    where: { id },
    select: { id: true, date: true, status: true, orderingEnabled: true },
  });
}

export async function skipThursday(formData: FormData) {
  await requireOrganizer();
  const input = skipInput.parse({
    eventId: formData.get("eventId"),
    reason: formData.get("reason") || undefined,
  });
  const event = await loadEvent(input.eventId);
  if (!canSkip(event, nyToday()))
    throw new Error("Only an upcoming scheduled Thursday can be skipped.");
  await db.breakfastEvent.update({
    where: { id: event.id },
    data: { status: "SKIPPED", skipReason: input.reason || "Holiday" },
  });
  refresh();
}

export async function restoreThursday(formData: FormData) {
  await requireOrganizer();
  const event = await loadEvent(eventId.parse(formData.get("eventId")));
  if (!canRestore(event, nyToday()))
    throw new Error("Only an upcoming skipped Thursday can be restored.");
  await db.breakfastEvent.update({
    where: { id: event.id },
    data: { status: "SCHEDULED", skipReason: null },
  });
  refresh();
}

export async function toggleOrderingEnabled(formData: FormData) {
  await requireOrganizer();
  const event = await loadEvent(eventId.parse(formData.get("eventId")));
  if (!canToggleOrdering(event, nyToday())) {
    throw new Error("Ordering on/off can only change before ordering opens.");
  }
  await db.breakfastEvent.update({
    where: { id: event.id },
    data: { orderingEnabled: !event.orderingEnabled },
  });
  refresh();
}

export async function addNextThursday() {
  await requireOrganizer();
  await addNext();
  refresh();
}
