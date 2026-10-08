import { expect, test } from "@playwright/test";
import { nyToday, nyWallTimeToUtc } from "../src/lib/thursdays";
import { fakeSlackConfigured, startFakeSlack } from "./fake-slack";
import { dbTask, signInAs } from "./helpers";

// M7 Tuesday reminder, against a fake Slack (e2e/fake-slack.ts). The cron route takes a
// `?now=` override under `next dev` only, so "Tuesday 10:30am ET" can be tested any day; we
// use the most recent Tuesday (never a future one, so syncing doesn't roll real weeks over).
// Restores every Thursday and setting it changes.

type EventState = {
  id: string;
  status: string;
  skipReason: string | null;
  reminderSentAt: string | null;
};
type Settings = {
  sponsorshipAmountCents: number;
  rsvpDeadlineWeekday: number;
  rsvpDeadlineTime: string;
  remindersEnabled: boolean;
};

const DAY = 24 * 60 * 60 * 1000;
const CRON_SECRET = process.env.CRON_SECRET;

/** The most recent Tuesday at 10:30 New York time, and that week's Thursday. */
function lastTuesday() {
  const today = nyToday();
  let tuesday = new Date(today.getTime() - ((today.getUTCDay() - 2 + 7) % 7) * DAY);
  if (nyWallTimeToUtc(tuesday, "10:30") > new Date())
    tuesday = new Date(tuesday.getTime() - 7 * DAY);
  return {
    at: (hhmm: string) => nyWallTimeToUtc(tuesday, hhmm).toISOString(),
    thursday: new Date(tuesday.getTime() + 2 * DAY).toISOString(),
  };
}

test.describe("Tuesday reminder (fake Slack)", () => {
  test.skip(!fakeSlackConfigured || !CRON_SECRET, "needs SLACK_* and CRON_SECRET in .env");

  let slack: Awaited<ReturnType<typeof startFakeSlack>>;
  let settings: Settings | null;
  const week = lastTuesday();
  const touched = new Map<string, EventState>();

  /** Remember a Thursday's original state the first time a test changes it. */
  function arrange(dateIso: string, change: { status?: string; skipReason?: string | null }) {
    const e = dbTask<EventState>("reminder-event", dateIso);
    if (!touched.has(e.id)) touched.set(e.id, e);
    dbTask("set-reminder-sent", e.id, "null");
    dbTask("set-event", e.id, JSON.stringify(change));
    return e.id;
  }

  const cron = (request: import("@playwright/test").APIRequestContext, now: string) =>
    request.get(`/api/cron/weekly-reminder?now=${encodeURIComponent(now)}`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });

  test.beforeAll(async () => {
    slack = await startFakeSlack();
    settings = dbTask<Settings | null>("get-settings");
    if (settings && !settings.remindersEnabled)
      dbTask("set-settings", JSON.stringify({ ...settings, remindersEnabled: true }));
  });

  test.afterAll(async () => {
    for (const e of touched.values()) {
      dbTask("set-event", e.id, JSON.stringify({ status: e.status, skipReason: e.skipReason }));
      dbTask("set-reminder-sent", e.id, e.reminderSentAt ?? "null");
    }
    if (settings) dbTask("set-settings", JSON.stringify(settings));
    await slack?.close();
  });

  test.beforeEach(() => slack.reset());

  test("refuses calls without the right CRON_SECRET", async ({ request }) => {
    const none = await request.get("/api/cron/weekly-reminder");
    expect(none.status()).toBe(401);
    const wrong = await request.get("/api/cron/weekly-reminder", {
      headers: { Authorization: "Bearer not-the-secret" },
    });
    expect(wrong.status()).toBe(401);
    expect(slack.calls).toHaveLength(0);
  });

  test("posts once on Tuesday after 10am; the second cron is skipped", async ({ request }) => {
    arrange(week.thursday, { status: "SCHEDULED", skipReason: null });

    const early = await cron(request, week.at("09:00"));
    expect(await early.json()).toMatchObject({ status: "skipped", reason: "too-early" });
    expect(slack.calls).toHaveLength(0);

    const first = await cron(request, week.at("10:30"));
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ status: "sent" });
    expect(slack.calls).toHaveLength(1);
    const call = slack.calls[0];
    expect(call.method).toBe("chat.postMessage");
    expect(call.authorization).toBe("Bearer xoxb-test-fake");
    expect(call.body.channel).toBe(process.env.SLACK_CHANNEL_ID);
    expect(call.body.text).toContain("*Breakfast Club — Thursday,");
    expect(call.body.text).not.toMatch(/\bpaid\b|unpaid/i);
    const buttons = call.body.blocks?.find((b) => b.type === "actions")?.elements ?? [];
    expect(buttons.map((b) => b.url)).toEqual([
      `${process.env.APP_URL}/`,
      `${process.env.APP_URL}/schedule`,
    ]);
    expect(dbTask<EventState>("reminder-event", week.thursday).reminderSentAt).not.toBeNull();

    const second = await cron(request, week.at("11:30"));
    expect(await second.json()).toMatchObject({ status: "skipped", reason: "already-sent" });
    expect(slack.calls).toHaveLength(1);
  });

  test("a Slack failure releases the claim so the next cron retries", async ({ request }) => {
    arrange(week.thursday, { status: "SCHEDULED", skipReason: null });
    slack.failNext("channel_not_found");

    const failed = await cron(request, week.at("10:30"));
    expect(failed.status()).toBe(502);
    expect(await failed.json()).toMatchObject({ status: "error" });
    expect(dbTask<EventState>("reminder-event", week.thursday).reminderSentAt).toBeNull();

    const retry = await cron(request, week.at("11:30"));
    expect(await retry.json()).toMatchObject({ status: "sent" });
    expect(slack.calls).toHaveLength(2);
  });

  test("a skipped Thursday posts nothing", async ({ request }) => {
    arrange(week.thursday, { status: "SKIPPED", skipReason: "E2E holiday" });
    const res = await cron(request, week.at("10:30"));
    expect(await res.json()).toMatchObject({ status: "skipped", reason: "thursday-skipped" });
    expect(slack.calls).toHaveLength(0);
    expect(dbTask<EventState>("reminder-event", week.thursday).reminderSentAt).toBeNull();
  });

  test("Send test reminder posts the preview and doesn't count as Tuesday's reminder", async ({
    page,
  }) => {
    const home = dbTask<{ date: string }>("home-event");
    arrange(home.date, { status: "SCHEDULED", skipReason: null });

    await signInAs(page, "Chelsea Merrill");
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Send test reminder" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Test reminder sent to #108state" }),
    ).toBeVisible();

    expect(slack.calls).toHaveLength(1);
    expect(slack.calls[0].body.text).toMatch(/^\[Test\] \*Breakfast Club — Thursday,/);
    expect(slack.calls[0].body.blocks?.[0]).toMatchObject({ type: "context" });
    expect(dbTask<EventState>("reminder-event", home.date).reminderSentAt).toBeNull();
  });
});

test.describe("Send test reminder without Slack", () => {
  test.skip(fakeSlackConfigured, "only when SLACK_BOT_TOKEN / SLACK_CHANNEL_ID aren't set");

  test("the button stays disabled with a hint", async ({ page }) => {
    await signInAs(page, "Chelsea Merrill");
    await page.goto("/admin/settings");
    const button = page.getByRole("button", { name: "Send test reminder" });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "Available once Slack is connected");
  });
});
