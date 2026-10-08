"use server";

import { requireOrganizer } from "@/lib/dal";
import { sendTestReminder } from "@/lib/reminder";

export type TestReminderState = { sent?: boolean; error?: string };

/**
 * Settings → Send test reminder: posts this week's preview to #108state, marked as a test.
 * Takes no input and never sets reminderSentAt, so Tuesday's real reminder still goes out.
 */
export async function sendTestReminderAction(): Promise<TestReminderState> {
  await requireOrganizer();
  const result = await sendTestReminder();
  return result.ok ? { sent: true } : { error: result.error };
}
