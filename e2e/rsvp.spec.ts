import { expect, test, type Page } from "@playwright/test";
import { dbTask, signInAs } from "./helpers";

// M3 — RSVP & headcount (docs/build-plan.md). These tests pin this Thursday's RSVP deadline
// themselves so they don't depend on the real clock, and put everything back afterwards.

type HomeEvent = {
  id: string;
  status: "SCHEDULED" | "SKIPPED";
  skipReason: string | null;
  rsvpDeadline: string | null;
};
const TESTERS = ["Jordan Reyes", "Nicole Roberts", "Chelsea Merrill"];
let event: HomeEvent;

const inFuture = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const inPast = () => new Date(Date.now() - 60 * 1000).toISOString();

test.beforeAll(() => {
  event = dbTask<HomeEvent>("home-event");
  if (event.status !== "SCHEDULED") throw new Error("This Thursday must be a scheduled week.");
  dbTask("clear-rsvps", event.id, ...TESTERS);
});

test.afterAll(() => {
  dbTask("clear-rsvps", event.id, ...TESTERS);
  dbTask(
    "set-event",
    event.id,
    JSON.stringify({
      rsvpDeadline: event.rsvpDeadline,
      status: event.status,
      skipReason: event.skipReason,
    }),
  );
});

const card = (page: Page) => page.getByLabel("This Thursday");
const headcount = async (page: Page) =>
  Number(await card(page).getByLabel("Headcount").textContent());

test("two members RSVP and both see each other's names and the count", async ({ browser }) => {
  dbTask("set-event", event.id, JSON.stringify({ rsvpDeadline: inFuture() }));
  const jordan = await browser.newPage();
  const nicole = await browser.newPage();
  await signInAs(jordan, "Jordan Reyes");
  await signInAs(nicole, "Nicole Roberts");

  await jordan.goto("/");
  const before = await headcount(jordan);
  await card(jordan).getByRole("button", { name: "I'm in" }).click();
  await expect(card(jordan).getByRole("button", { name: "I'm in" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(card(jordan)).toContainText("Jordan Reyes");

  await nicole.goto("/");
  await card(nicole).getByRole("button", { name: "I'm in" }).click();
  await expect(card(nicole)).toContainText(/In:.*Jordan Reyes.*Nicole Roberts/);
  await expect.poll(() => headcount(nicole)).toBe(before + 2);

  // Jordan sees Nicole too, and the same count.
  await jordan.reload();
  await expect(card(jordan)).toContainText("Nicole Roberts");
  expect(await headcount(jordan)).toBe(before + 2);

  // Changing your answer moves you to Out.
  await card(jordan).getByRole("button", { name: "Not this week" }).click();
  await expect(card(jordan)).toContainText(/Out:.*Jordan Reyes/);
  await expect.poll(() => headcount(jordan)).toBe(before + 1);
});

test("after the deadline members can't change their RSVP, but the organizer can", async ({
  browser,
}) => {
  dbTask("set-event", event.id, JSON.stringify({ rsvpDeadline: inPast() }));

  const jordan = await browser.newPage();
  await signInAs(jordan, "Jordan Reyes");
  await jordan.goto("/");
  await expect(card(jordan).getByRole("button", { name: "I'm in" })).toBeDisabled();
  await expect(card(jordan).getByRole("button", { name: "Not this week" })).toBeDisabled();
  await expect(card(jordan)).toContainText("RSVPs closed Wed 5pm");

  const chelsea = await browser.newPage();
  await signInAs(chelsea, "Chelsea Merrill");
  await chelsea.goto("/");
  await card(chelsea).getByRole("button", { name: "I'm in" }).click();
  await expect(card(chelsea)).toContainText(/In:.*Chelsea Merrill/);
});

test("a skipped Thursday shows a banner instead of RSVP buttons", async ({ page }) => {
  dbTask("set-event", event.id, JSON.stringify({ status: "SKIPPED", skipReason: "Team offsite" }));
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  await expect(card(page)).toContainText("No breakfast this Thursday: Team offsite");
  await expect(card(page)).toContainText("Next breakfast is");
  await expect(card(page).getByRole("button", { name: "I'm in" })).toHaveCount(0);
  dbTask("set-event", event.id, JSON.stringify({ status: "SCHEDULED", skipReason: null }));
});
