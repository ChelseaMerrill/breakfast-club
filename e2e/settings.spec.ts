import { expect, test } from "@playwright/test";
import { dbTask, signInAs } from "./helpers";

// Settings (design: organizer Settings screen). Restores the original settings afterwards.

type Settings = {
  sponsorshipAmountCents: number;
  rsvpDeadlineWeekday: number;
  rsvpDeadlineTime: string;
  remindersEnabled: boolean;
};
let original: Settings;

test.beforeAll(() => {
  original = dbTask<Settings | null>("get-settings") ?? {
    sponsorshipAmountCents: 3000,
    rsvpDeadlineWeekday: 3,
    rsvpDeadlineTime: "17:00",
    remindersEnabled: true,
  };
});

test.afterAll(() => {
  dbTask("set-settings", JSON.stringify(original));
});

test("Chelsea changes the RSVP deadline and amount; Home and the Slack preview follow", async ({
  page,
}) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/settings");
  const preview = page.getByLabel("Slack preview");
  await expect(preview).toContainText("Breakfast Club — Thursday");
  await expect(preview).toContainText("Headcount so far:");

  await page.getByLabel("Sponsorship amount").fill("35");
  await page.getByLabel("RSVP deadline day").selectOption("Tuesday");
  await page.getByLabel("RSVP deadline time").fill("09:30");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();

  await expect(preview).toContainText("RSVP by Tuesday 9:30am.");
  expect(dbTask<Settings>("get-settings").sponsorshipAmountCents).toBe(3500);

  await page.goto("/");
  await expect(page.getByLabel("This Thursday")).toContainText("RSVP by Tue 9:30am ET");
});

test("a bad amount is refused with a message", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/settings");
  await page.getByLabel("Sponsorship amount").fill("lots");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Enter the sponsorship amount in dollars, like 30.")).toBeVisible();
});

test("turning weekly reminders off shows in the preview", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/settings");
  await page.getByText("Weekly reminders on").click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByLabel("Slack preview")).toContainText(
    "Weekly reminders are off, so nothing will be posted.",
  );
  expect(dbTask<Settings>("get-settings").remindersEnabled).toBe(false);
});

test("members can't open Settings", async ({ page }) => {
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
  const res = await page.goto("/admin/settings");
  expect(res?.status()).toBe(403);
});
