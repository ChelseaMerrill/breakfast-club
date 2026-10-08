import { expect, test, type Page } from "@playwright/test";
import { fakeSlackConfigured, startFakeSlack } from "./fake-slack";
import { dbTask, signInAs } from "./helpers";

// "Your order is ready" Slack DM (open-questions #50), against the fake Slack. Needs the fake
// Slack settings in .env (see e2e/fake-slack.ts); skipped otherwise. Restores what it changes.

const MEMBER = "Alex Kim";
const SEED_ID = "SEED_ALEX_KIM";
const FAKE_SLACK_ID = "U0READYDM1";

type OrderingState = {
  status: "SCHEDULED" | "ORDERING_OPEN" | "ORDERING_CLOSED";
  orderingEnabled: boolean;
};

test.describe("ready DM (fake Slack)", () => {
  test.skip(!fakeSlackConfigured, "needs the fake Slack settings in .env");

  let slack: Awaited<ReturnType<typeof startFakeSlack>>;
  let eventId: string;
  let original: OrderingState;

  test.beforeAll(async () => {
    slack = await startFakeSlack();
    eventId = dbTask<{ id: string }>("home-event").id;
    original = dbTask<OrderingState>("ordering-state", eventId);
    dbTask("set-slack-id", MEMBER, FAKE_SLACK_ID);
  });

  test.afterAll(async () => {
    dbTask("set-slack-id", MEMBER, SEED_ID);
    dbTask(
      "ordering-reset",
      eventId,
      JSON.stringify({ status: original.status, orderingEnabled: original.orderingEnabled }),
    );
    await slack?.close();
  });

  const card = (page: Page, column: string, who: string) =>
    page.getByRole("region", { name: column }).locator("article", { hasText: who });

  async function runTo(page: Page, who: string, steps: [string, RegExp][]) {
    for (const [from, label] of steps) {
      await card(page, from, who).getByRole("button", { name: label }).click();
    }
  }

  test("moving a member's order to Ready DMs them once; guests get nothing", async ({ page }) => {
    dbTask(
      "ordering-reset",
      eventId,
      JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
    );
    slack.reset();
    await signInAs(page, "Chelsea Merrill");
    await page.goto(`/kitchen/${eventId}`);

    for (const who of [MEMBER, "Guest Ready"]) {
      await page.getByLabel("Walk-in name").fill(who);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(card(page, "Placed", who)).toBeVisible();
    }

    await runTo(page, MEMBER, [
      ["Placed", /Start cooking/],
      ["Cooking", /Mark ready/],
    ]);
    await expect(card(page, "Ready", MEMBER)).toBeVisible();
    await expect.poll(() => slack.calls.length).toBe(1);
    const dm = slack.calls[0];
    expect(dm.method).toBe("chat.postMessage");
    expect(dm.body.channel).toBe(FAKE_SLACK_ID);
    expect(dm.body.text).toContain("Your breakfast is ready!");
    expect(JSON.stringify(dm.body.blocks)).toContain(`/kitchen/${eventId}`);

    // A guest has no Slack account: no DM.
    await runTo(page, "Guest Ready", [
      ["Placed", /Start cooking/],
      ["Cooking", /Mark ready/],
    ]);
    await expect(card(page, "Ready", "Guest Ready")).toBeVisible();

    // Picked up, and stepping back to Ready, don't DM again.
    await runTo(page, MEMBER, [["Ready", /Picked up/]]);
    await card(page, "Picked up", MEMBER).getByRole("button", { name: "← Back" }).click();
    await expect(card(page, "Ready", MEMBER)).toBeVisible();
    await page.waitForTimeout(1500); // give any stray after() work time to run
    expect(slack.calls).toHaveLength(1);
  });
});
