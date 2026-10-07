"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOrganizer } from "@/lib/dal";

export type SettingsState = { ok?: boolean; error?: string };

const settingsInput = z.object({
  // "$30", "30" or "30.50" → cents. Applies to new sponsorships only (old ones keep theirs).
  amount: z
    .string()
    .trim()
    .transform((v) => (v === "" ? NaN : Number(v.replace(/^$/, ""))))
    .pipe(
      z
        .number({ message: "Enter the sponsorship amount in dollars, like 30." })
        .min(1, "The sponsorship amount must be at least $1.")
        .max(500, "The sponsorship amount can be at most $500."),
    )
    .transform((dollars) => Math.round(dollars * 100)),
  rsvpDeadlineWeekday: z.coerce.number().int().min(0).max(6),
  rsvpDeadlineTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time for the RSVP deadline."),
  remindersEnabled: z.literal("on").optional(),
});

/** Saves the organizer's settings (design: Settings). */
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireOrganizer();
  const parsed = settingsInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings." };

  const { amount, rsvpDeadlineWeekday, rsvpDeadlineTime, remindersEnabled } = parsed.data;
  const data = {
    sponsorshipAmountCents: amount,
    rsvpDeadlineWeekday,
    rsvpDeadlineTime,
    remindersEnabled: remindersEnabled === "on",
  };
  await db.appSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/schedule");
  return { ok: true };
}
