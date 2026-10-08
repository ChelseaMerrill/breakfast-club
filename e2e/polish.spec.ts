import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// M8 — polish: friendly not-found pages instead of Next's defaults.

test("a bad Thursday link shows the Not found page", async ({ page }) => {
  await signInAs(page, "Jordan Reyes");
  await page.goto("/kitchen/not-a-real-thursday");
  await expect(page.getByText("We couldn't find that page.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Home →" })).toBeVisible();
});

test("an unknown address shows the Not found page", async ({ page }) => {
  await signInAs(page, "Jordan Reyes");
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("We couldn't find that page.")).toBeVisible();
});
