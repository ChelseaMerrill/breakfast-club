import { Suspense } from "react";
import { Card, PageTitle } from "@/components/bc";
import { SettingsForm } from "@/components/settings-form";
import { requireOrganizer } from "@/lib/dal";
import { getSettings, reminderPreview } from "@/lib/settings";
import { formatThursday } from "@/lib/thursdays";

// Settings (design: organizer "Settings" screen, route /admin/settings).
const SLACK_CHANNEL = "#108state";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageTitle>Settings</PageTitle>
      <Suspense fallback={<p className="text-muted-foreground">Loading settings…</p>}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  await requireOrganizer();
  const [settings, preview] = await Promise.all([getSettings(), reminderPreview()]);
  const slackConnected = Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID);

  return (
    <div className="grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
      <Card>
        <SettingsForm
          values={{
            amountDollars: String(settings.sponsorshipAmountCents / 100),
            rsvpDeadlineWeekday: settings.rsvpDeadlineWeekday,
            rsvpDeadlineTime: settings.rsvpDeadlineTime,
            remindersEnabled: settings.remindersEnabled,
            slackChannel: SLACK_CHANNEL,
            slackConnected,
          }}
        />
      </Card>

      <Card aria-label="Slack preview" className="gap-0 text-sm leading-[1.7]">
        <p className="mb-2 text-[11px] font-bold text-muted-foreground uppercase">
          Slack preview · {SLACK_CHANNEL}
        </p>
        {!settings.remindersEnabled && (
          <p className="mb-2 text-[13px] text-destructive">
            Weekly reminders are off, so nothing will be posted.
          </p>
        )}
        {!preview ? (
          <p className="text-muted-foreground">No Thursdays on the schedule yet.</p>
        ) : preview.skipped ? (
          <p className="text-muted-foreground">
            No reminder this week: {formatThursday(preview.date)} is skipped
            {preview.reason ? ` (${preview.reason})` : ""}.
          </p>
        ) : (
          <>
            <p className="font-bold">{preview.message.title}</p>
            {preview.message.menu.length > 0 && (
              <>
                <p>On the menu:</p>
                {preview.message.menu.map((m) => (
                  <p key={m.name}>
                    • {m.name} — <i>{m.sponsorText}</i>
                  </p>
                ))}
              </>
            )}
            {preview.message.notes.map((n) => (
              <p key={n}>
                <i>{n}</i>
              </p>
            ))}
            <p>
              Headcount so far: <b>{preview.message.headcount}</b>
            </p>
            <p>
              RSVP by <b>{preview.message.rsvpBy}</b>.
            </p>
            <p className="mt-2 flex gap-2">
              <span className="rounded-[14px] border-2 border-border px-3 py-1 text-xs">RSVP</span>
              <span className="rounded-[14px] border-2 border-border px-3 py-1 text-xs">
                Sponsor an item
              </span>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
