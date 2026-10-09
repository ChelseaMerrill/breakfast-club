import { expect, test } from "@playwright/test";
import { fakeSlackConfigured, startFakeSlack } from "./fake-slack";
import { dbTask, signInAs } from "./helpers";

// "Ordering is open" post to #108state (open-questions #55), against the fake Slack. Needs the
// fake Slack settings in .env (see e2e/fake-slack.ts); skipped otherwise.

type OrderingState = {
  status: "SCHEDULED" | "ORDERING_OPEN" | "ORDERING_CLOSED";
  orderingEnabled: boolean;
};

test.describe("ordering-open post (fake Slack)", () => {
  test.skip(!fakeSlackConfigured, "needs the fake Slack settings in .env");

  let slack: Awaited<ReturnType<typeof startFakeSlack>>;
  let eventId: string;
  let original: OrderingState;

  test.beforeAll(async () => {
    slack = await startFakeSlack();
    eventId = dbTask<{ id: string }>("home-event").id;
    original = dbTask<OrderingState>("ordering-state", eventId);
  });

  test.afterAll(async () => {
    dbTask(
      "ordering-reset",
      eventId,
      JSON.stringify({ status: original.status, orderingEnabled: original.orderingEnabled }),
    );
    await slack?.close();
  });

  test("Chelsea writes the message, it posts with a Place your order button; a reopen doesn't post by default", async ({
    page,
  }) => {
    dbTask(
      "ordering-reset",
      eventId,
      JSON.stringify({ status: "SCHEDULED", orderingEnabled: true }),
    );
    slack.reset();
    await signInAs(page, "Chelsea Merrill");
    await page.goto(`/kitchen/${eventId}`);

    await page.getByRole("button", { name: "Open ordering" }).click();
    const compose = page.getByRole("form", { name: "Open ordering" });
    await expect(compose.getByLabel("Post to #108state")).toBeChecked();
    await compose
      .getByLabel(/This week's message/)
      .fill("Eggs today: scrambled or fried? Say which in Customize & enjoy <3");
    await compose.getByRole("button", { name: "Open ordering & post" }).click();
    await expect(page.getByRole("status").filter({ hasText: "posted to #108state" })).toBeVisible();

    expect(slack.calls).toHaveLength(1);
    const post = slack.calls[0];
    expect(post.body.channel).toBe(process.env.SLACK_CHANNEL_ID);
    expect(post.body.text).toContain("Eggs today: scrambled or fried?");
    expect(post.body.text).toContain("&amp; enjoy &lt;3"); // escaped for Slack
    expect(JSON.stringify(post.body.blocks)).toContain(`/order/${eventId}`);

    // Close, then reopen: the box keeps the message and doesn't post again unless ticked.
    await page.getByRole("button", { name: "Close ordering" }).click();
    await page.getByRole("button", { name: "Open ordering" }).click();
    await expect(compose.getByLabel(/This week's message/)).toHaveValue(/Eggs today/);
    await expect(compose.getByLabel("Post to #108state")).not.toBeChecked();
    await compose.getByRole("button", { name: /^Open ordering$/ }).click();
    await expect(page.getByText("Nothing was posted to Slack.")).toBeVisible();
    expect(slack.calls).toHaveLength(1);
  });

  test("if Slack refuses, ordering still opens and Chelsea sees why", async ({ page }) => {
    dbTask(
      "ordering-reset",
      eventId,
      JSON.stringify({ status: "SCHEDULED", orderingEnabled: true }),
    );
    slack.reset();
    slack.failNext("channel_not_found");
    await signInAs(page, "Chelsea Merrill");
    await page.goto(`/kitchen/${eventId}`);
    await page.getByRole("button", { name: "Open ordering" }).click();
    await page.getByRole("button", { name: "Open ordering & post" }).click();
    await expect(page.getByText("Ordering is open", { exact: true })).toBeVisible();
    await expect(page.getByText(/Slack post didn't go out: channel_not_found/)).toBeVisible();
  });
});
