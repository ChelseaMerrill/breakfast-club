import { expect, test } from "@playwright/test";
import { formatShortThursday } from "../src/lib/thursdays";
import { dbTask, signInAs } from "./helpers";

// M2 — Schedule & skip weeks (docs/build-plan.md).

type Target = { id: string; date: string; orderingEnabled: boolean; lastDate: string };
let target: { id: string; date: Date; orderingEnabled: boolean };
let lastDateBefore: Date;

test.beforeAll(async ({ browser }) => {
  // Load the schedule once so the 8-week top-up has run, then pick the furthest-out
  // Thursday with no menu, so seed weeks stay untouched.
  const page = await browser.newPage();
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/schedule");
  await page.close();
  const found = dbTask<Target | null>("last-scheduled");
  if (!found) throw new Error("No scheduled Thursday without a menu to test with.");
  target = { id: found.id, date: new Date(found.date), orderingEnabled: found.orderingEnabled };
  lastDateBefore = new Date(found.lastDate);
});

test.afterAll(() => {
  dbTask("reset-event", target.id, lastDateBefore.toISOString(), String(target.orderingEnabled));
});

test("Chelsea skips a Thursday and it shows faded on the Schedule", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  const label = formatShortThursday(target.date);

  await page.goto("/admin/events");
  const row = page.locator("article", { hasText: label });
  await row.getByRole("button", { name: "Skip" }).click();
  await row.getByLabel(`Reason for skipping ${label}`).fill("Thanksgiving");
  await row.getByRole("button", { name: "Confirm" }).click();
  await expect(row).toContainText("No breakfast: Thanksgiving");
  await expect(row).toContainText("Skipped");
  await expect(row.getByRole("button", { name: "Restore" })).toBeVisible();

  await page.goto("/schedule");
  const card = page.locator("article", { hasText: label });
  await expect(card).toContainText("No breakfast: Thanksgiving");
  await expect(card).toHaveClass(/opacity-60/);

  // Restore puts it back.
  await page.goto("/admin/events");
  await page
    .locator("article", { hasText: label })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(page.locator("article", { hasText: label })).toContainText("Scheduled");
});

test("ordering on/off toggles", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/events");
  const toggle = page
    .locator("article", { hasText: formatShortThursday(target.date) })
    .getByRole("switch", { name: "Ordering enabled" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.goto("/schedule");
  await expect(
    page.locator("article", { hasText: formatShortThursday(target.date) }),
  ).toContainText("RSVP only");
});

test("Add next Thursday extends the schedule by one week", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/events");
  const next = formatShortThursday(new Date(lastDateBefore.getTime() + 7 * 24 * 60 * 60 * 1000));
  await expect(page.locator("article", { hasText: next })).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add next Thursday" }).click();
  await expect(page.locator("article", { hasText: next })).toHaveCount(1);
});

test("members can see the Schedule but not Thursdays", async ({ page }) => {
  await signInAs(page, "Jordan Reyes");
  await page.goto("/schedule");
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Thursdays" })).toHaveCount(0);

  const res = await page.goto("/admin/events");
  expect(res?.status()).toBe(403);
  await expect(page.getByText("Organizers only")).toBeVisible();
});

test("phone width: nav collapses into a menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  const nav = page.locator("#app-nav");
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "☰ Menu" }).click();
  await nav.getByRole("link", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(nav).toBeHidden();
});
