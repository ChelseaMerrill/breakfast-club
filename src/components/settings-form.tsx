"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsState } from "@/app/(app)/admin/settings/actions";
import {
  sendTestReminderAction,
  type TestReminderState,
} from "@/app/(app)/admin/settings/test-reminder-action";
import { PillButton } from "@/components/bc";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const field =
  "rounded-[14px] border-[3px] border-border bg-white p-2.5 text-[15px] text-foreground disabled:bg-muted disabled:text-muted-foreground";
const hint = "text-xs text-muted-foreground";

export type SettingsFormValues = {
  amountDollars: string;
  rsvpDeadlineWeekday: number;
  rsvpDeadlineTime: string;
  remindersEnabled: boolean;
  slackChannel: string;
  slackConnected: boolean;
};

/** Design: Settings (left card). */
export function SettingsForm({ values }: { values: SettingsFormValues }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const [test, testAction, testPending] = useActionState<TestReminderState, FormData>(
    sendTestReminderAction,
    {},
  );
  const [reminders, setReminders] = useState(values.remindersEnabled);

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5 text-[13px]">
        Sponsorship amount
        <span className="flex items-center gap-2">
          <span className="text-lg font-bold">$</span>
          <input
            name="amount"
            inputMode="decimal"
            defaultValue={values.amountDollars}
            className={cn(field, "w-28")}
            required
          />
        </span>
        <span className={hint}>Applies to new sponsorships; existing ones keep their amount.</span>
      </label>

      <fieldset className="flex flex-col gap-1.5 text-[13px]">
        <legend className="mb-1.5">RSVP deadline</legend>
        <span className="flex flex-wrap items-center gap-2">
          <select
            name="rsvpDeadlineWeekday"
            defaultValue={values.rsvpDeadlineWeekday}
            aria-label="RSVP deadline day"
            className={field}
          >
            {WEEKDAYS.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
          <input
            type="time"
            name="rsvpDeadlineTime"
            defaultValue={values.rsvpDeadlineTime}
            aria-label="RSVP deadline time"
            className={field}
            required
          />
          <span className="font-semibold">ET</span>
        </span>
        <span className={hint}>
          The day before Thursday or earlier; members can&apos;t change their RSVP after it.
        </span>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-[13px]">
        Reminder day and time
        <input value="Tuesday, 10–11am ET" disabled className={field} />
        <span className={hint}>
          Fixed for now: the Vercel Hobby plan only runs scheduled jobs once a day, within the hour.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-[13px]">
        Slack channel
        <input value={values.slackChannel} disabled className={field} />
        {!values.slackConnected && (
          <span className={hint}>Slack isn&apos;t connected yet, so nothing is posted.</span>
        )}
      </label>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="remindersEnabled"
          checked={reminders}
          onChange={(e) => setReminders(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={cn(
            "relative inline-block h-5 w-[38px] rounded-[10px] peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
            reminders ? "bg-primary" : "bg-[#C9B79C]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white transition-[left]",
              reminders ? "left-5" : "left-0.5",
            )}
          />
        </span>
        Weekly reminders on
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <PillButton type="submit" disabled={pending} className="px-6 py-2.5 text-[13px]">
          {pending ? "Saving…" : "Save settings"}
        </PillButton>
        <button
          type="submit"
          formAction={testAction}
          formNoValidate
          disabled={!values.slackConnected || testPending}
          title={values.slackConnected ? undefined : "Available once Slack is connected"}
          className="cursor-pointer rounded-full border-[3px] border-border px-6 py-2.5 text-[13px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testPending ? "Sending…" : "Send test reminder"}
        </button>
      </div>
      <p role="status" className="text-[13px] text-destructive">
        {state.error ?? (state.ok && !pending ? "Settings saved." : "")}
      </p>
      <p role="status" className="text-[13px] text-destructive">
        {testPending
          ? ""
          : (test.error ?? (test.sent ? `Test reminder sent to ${values.slackChannel}` : ""))}
      </p>
    </form>
  );
}
