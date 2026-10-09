import { expect, test } from "@playwright/test";
import { nyToday, nyWallTimeToUtc } from "../src/lib/thursdays";
import { fakeSlackConfigured, startFakeSlack } from "./fake-slack";
import { dbTask } from "./helpers";

// Wednesday 11am ET unpaid-sponsor DMs (open-questions #56), against the fake Slack. Uses the
// cron's `?now=` override (next dev only) with the most recent Wednesday, so it runs any day.
// Adds its own menu items to that week's Thursday and removes them afterwards.

type EventState = {
  id: string;
  status: string;
  skipReason: string | null;
  paymentReminderSentAt: string | null;
};

const DAY = 24 * 60 * 60 * 1000;
const CRON_SECRET = process.env.CRON_SECRET;
const UNPAID = { name: "Jordan Reyes", seedId: "SEED_JORDAN_REYES", slackId: "UPAYTEST1" };
const PAID = { name: "Sam Lee", seedId: "SEED_SAM_LEE", slackId: "UPAYTEST2" };
const SEED_ONLY = "Priya Nair"; // keeps her SEED_ id, so she can't be DMed

/** The most recent Wednesday at/after 11:30 New York time, and that week's Thursday. */
function lastWednesday() {
  const today = nyToday();
  let wednesday = new Date(today.getTime() - ((today.getUTCDay() - 3 + 7) % 7) * DAY);
  if (nyWallTimeToUtc(wednesday, "11:30") > new Date())
    wednesday = new Date(wednesday.getTime() - 7 * DAY);
  return {
    at: (hhmm: string) => nyWallTimeToUtc(wednesday, hhmm).toISOString(),
    thursday: new Date(wednesday.getTime() + DAY).toISOString(),
  };
}

test.describe("Wednesday payment reminder (fake Slack)", () => {
  test.skip(!fakeSlackConfigured || !CRON_SECRET, "needs SLACK_* and CRON_SECRET in .env");

  let slack: Awaited<ReturnType<typeof startFakeSlack>>;
  const week = lastWednesday();
  let original: EventState;
  const created: string[] = [];

  const cron = (request: import("@playwright/test").APIRequestContext, now: string) =>
    request.get(`/api/cron/payment-reminder?now=${encodeURIComponent(now)}`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
  const dmsTo = (id: string) => slack.calls.filter((c) => c.body.channel === id);

  test.beforeAll(async () => {
    slack = await startFakeSlack();
    original = dbTask<EventState>("payment-reminder-event", week.thursday);
    dbTask("set-event", original.id, JSON.stringify({ status: "SCHEDULED", skipReason: null }));
    created.push(dbTask<string>("payments-setup", original.id, "E2E Pay Waffles", UNPAID.name));
    const paid = dbTask<string>("payments-setup", original.id, "E2E Pay Quiche", PAID.name);
    created.push(paid);
    created.push(dbTask<string>("payments-setup", original.id, "E2E Pay Bagels", SEED_ONLY));
    dbTask("set-paid", paid, "true");
    dbTask("set-slack-id", UNPAID.name, UNPAID.slackId);
    dbTask("set-slack-id", PAID.name, PAID.slackId);
  });

  test.afterAll(async () => {
    for (const id of created) dbTask("remove-sponsorship-item", id);
    dbTask("set-slack-id", UNPAID.name, UNPAID.seedId);
    dbTask("set-slack-id", PAID.name, PAID.seedId);
    dbTask(
      "set-event",
      original.id,
      JSON.stringify({ status: original.status, skipReason: original.skipReason }),
    );
    dbTask("set-payment-reminder-sent", original.id, original.paymentReminderSentAt ?? "null");
    await slack?.close();
  });

  test.beforeEach(() => {
    slack.reset();
    dbTask("set-payment-reminder-sent", original.id, "null");
  });

  test("refuses calls without the right CRON_SECRET", async ({ request }) => {
    const none = await request.get("/api/cron/payment-reminder");
    expect(none.status()).toBe(401);
    expect(slack.calls).toHaveLength(0);
  });

  test("DMs unpaid sponsors once on Wednesday after 11am; paid and non-Slack sponsors get nothing", async ({
    request,
  }) => {
    const early = await cron(request, week.at("10:30"));
    expect(await early.json()).toMatchObject({ status: "skipped", reason: "too-early" });
    expect(slack.calls).toHaveLength(0);

    const first = await cron(request, week.at("11:30"));
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ status: "sent" });
    const dms = dmsTo(UNPAID.slackId);
    expect(dms).toHaveLength(1);
    expect(dms[0].method).toBe("chat.postMessage");
    expect(dms[0].body.text).toContain("E2E Pay Waffles");
    expect(dms[0].body.text).toContain("Pay with cash or Venmo @Chelsea-Merrill-1.");
    expect(dms[0].body.text).not.toContain("E2E Pay Quiche");
    expect(dmsTo(PAID.slackId)).toHaveLength(0);
    expect(slack.calls.filter((c) => c.body.channel?.startsWith("SEED_"))).toHaveLength(0);
    expect(slack.calls.filter((c) => c.body.channel === process.env.SLACK_CHANNEL_ID)).toHaveLength(
      0,
    ); // never in the channel

    const second = await cron(request, week.at("12:00"));
    expect(await second.json()).toMatchObject({ status: "skipped", reason: "already-sent" });
    expect(dmsTo(UNPAID.slackId)).toHaveLength(1);
  });

  test("if every DM fails, the claim is released so the second cron retries", async ({
    request,
  }) => {
    slack.failAll("ratelimited");
    const failed = await cron(request, week.at("11:30"));
    expect(failed.status()).toBe(502);
    expect(
      dbTask<EventState>("payment-reminder-event", week.thursday).paymentReminderSentAt,
    ).toBeNull();

    slack.reset();
    const retry = await cron(request, week.at("12:30"));
    expect(await retry.json()).toMatchObject({ status: "sent" });
    expect(dmsTo(UNPAID.slackId)).toHaveLength(1);
  });

  test("not on other days", async ({ request }) => {
    const tuesday = new Date(new Date(week.at("11:30")).getTime() - DAY).toISOString();
    const res = await cron(request, tuesday);
    expect(await res.json()).toMatchObject({ status: "skipped", reason: "not-reminder-day" });
    expect(slack.calls).toHaveLength(0);
  });
});
