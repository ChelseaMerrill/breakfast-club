"use server";

import { revalidatePath } from "next/cache";
import { requireOrganizer } from "@/lib/dal";
import { db } from "@/lib/db";
import { paidUpdate, setPaidInput } from "@/lib/payments";

// Payments mutations (M5). Only the organizer marks a sponsorship Paid / unpaid; `paidAt` is
// recorded. Remove reuses removeSponsorship from the Schedule actions.

export type SetPaidResult = { ok: true } | { ok: false; error: string };

/** The Paid checkbox: sets the sponsorship to the given state (repeat clicks are no-ops). */
export async function setSponsorshipPaid(formData: FormData): Promise<SetPaidResult> {
  await requireOrganizer();
  const parsed = setPaidInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { sponsorshipId, paid } = parsed.data;

  const current = await db.sponsorship.findUnique({
    where: { id: sponsorshipId },
    select: { paid: true },
  });
  if (!current) return { ok: false, error: "That sponsorship was removed." };
  const data = paidUpdate(current, paid);
  // Conditional on the state just read, so a concurrent change isn't overwritten with a new paidAt.
  if (data) await db.sponsorship.updateMany({ where: { id: sponsorshipId, paid: !paid }, data });

  revalidatePath("/admin/payments");
  revalidatePath("/");
  return { ok: true };
}
