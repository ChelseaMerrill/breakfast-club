import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

// App Guide (linked at the bottom of the nav).

test("members open the App Guide from the nav and don't see the organizer section", async ({
  page,
}) => {
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  await page.getByRole("link", { name: "📖 App Guide" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { name: "The week at a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Order on Thursday morning/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "📖 App Guide" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("For Chelsea: running Thursday")).toHaveCount(0);
});

test("the organizer sees the running-Thursday section with links", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/guide");
  const org = page.getByRole("region", { name: "For Chelsea: running Thursday" });
  await expect(org).toBeVisible();
  await expect(org.getByRole("link", { name: "Payments" })).toHaveAttribute(
    "href",
    "/admin/payments",
  );
});

test("phone width: App Guide is in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  await page.getByRole("button", { name: "☰ Menu" }).click();
  await page.getByRole("link", { name: "📖 App Guide" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
