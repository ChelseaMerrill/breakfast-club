import { expect, test, type Page } from "@playwright/test";
import { formatDollars } from "../src/lib/sponsorship-display";
import { formatShortThursday } from "../src/lib/thursdays";
import { dbTask, signInAs } from "./helpers";

// M5 — Payments (docs/build-plan.md). Each test gives the furthest-out Thursday with no menu an
// "E2E Pancakes" item with one unpaid sponsorship by Jordan Reyes, and removes both afterwards.

type Target = { id: string; date: string; sponsorsNeeded: number };
type Summary = { collectedCents: number; outstandingCents: number; thisWeekCount: number };
type PaidState = { paid: boolean; paidAt: string | null } | null;

const ITEM = "E2E Pancakes";
let target: Target;
let label: string;
let sponsorshipId: string;

test.beforeAll(async ({ browser }) => {
  // Load the schedule once so the 8-week top-up has run.
  const page = await browser.newPage();
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/schedule");
  await page.close();
  const found = dbTask<Target | null>("sponsor-target");
  if (!found) throw new Error("No scheduled Thursday without a menu to test with.");
  target = found;
  label = formatShortThursday(new Date(found.date));
});

test.beforeEach(() => {
  sponsorshipId = dbTask<string>("payments-setup", target.id, ITEM, "Jordan Reyes");
});

test.afterEach(() => {
  dbTask("reset-menu", target.id, String(target.sponsorsNeeded));
});

const paymentRow = (page: Page) =>
  page.getByRole("row").filter({ hasText: ITEM }).filter({ hasText: label });
const paidBox = (page: Page) =>
  paymentRow(page).getByRole("checkbox", { name: `Paid: Jordan Reyes, ${ITEM}, ${label}` });

async function expectTotals(page: Page, s: Summary) {
  await expect(page.getByTestId("collected")).toHaveText(formatDollars(s.collectedCents));
  await expect(page.getByTestId("outstanding")).toHaveText(formatDollars(s.outstandingCents));
}

async function myRow(page: Page) {
  await page.goto("/");
  return page
    .getByRole("region", { name: "My sponsorships" })
    .getByRole("listitem")
    .filter({ hasText: label });
}

test("Chelsea checks off a sponsorship and the sponsor sees Paid ✓", async ({ page }) => {
  // Before: Jordan owes $30 and can still remove it.
  await signInAs(page, "Jordan Reyes");
  let row = await myRow(page);
  await expect(row).toContainText(`${ITEM} · Jordan Reyes`);
  await expect(row).toContainText("$30 due");
  await expect(row.getByRole("button", { name: /^Remove/ })).toBeVisible();

  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/payments?filter=all");
  const before = dbTask<Summary>("payments-summary");
  await expectTotals(page, before);
  await expect(paymentRow(page)).toContainText("$30");
  await expect(paidBox(page)).toHaveAttribute("aria-checked", "false");

  await paidBox(page).click();
  await expect(paidBox(page)).toHaveAttribute("aria-checked", "true");
  await expectTotals(page, {
    ...before,
    collectedCents: before.collectedCents + 3000,
    outstandingCents: before.outstandingCents - 3000,
  });
  await expect.poll(() => dbTask<PaidState>("sponsorship-paid", sponsorshipId)?.paid).toBe(true);
  expect(dbTask<PaidState>("sponsorship-paid", sponsorshipId)?.paidAt).not.toBeNull();

  // After: Jordan sees Paid ✓ and can no longer remove it.
  await signInAs(page, "Jordan Reyes");
  row = await myRow(page);
  await expect(row).toContainText("Paid ✓");
  await expect(row).not.toContainText("$30 due");
  await expect(row.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  // Unchecking puts it back and clears paidAt.
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/payments?filter=all");
  await paidBox(page).click();
  await expect(paidBox(page)).toHaveAttribute("aria-checked", "false");
  await expectTotals(page, before);
  await expect
    .poll(() => dbTask<PaidState>("sponsorship-paid", sponsorshipId))
    .toEqual({ paid: false, paidAt: null });
});

test("filters: Unpaid (default), This week, All", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/payments");
  const filters = page.getByRole("navigation", { name: "Filter payments" });
  await expect(filters.getByRole("link", { name: "Unpaid" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(paymentRow(page)).toHaveCount(1);
  await expect(
    page.getByText("Payment status is visible only to you and the sponsors."),
  ).toBeVisible();

  // Marked paid, it drops out of Unpaid…
  await paidBox(page).click();
  await expect(paymentRow(page)).toHaveCount(0);
  await expect.poll(() => dbTask<PaidState>("sponsorship-paid", sponsorshipId)?.paid).toBe(true);

  // …but is still under All.
  await filters.getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(/\/admin\/payments\?filter=all$/);
  await expect(filters.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  await expect(paidBox(page)).toHaveAttribute("aria-checked", "true");

  // This week is Home's Thursday only, so the far-out test Thursday isn't there.
  await filters.getByRole("link", { name: "This week" }).click();
  await expect(page).toHaveURL(/\?filter=week$/);
  await expect(paymentRow(page)).toHaveCount(0);
  const { thisWeekCount } = dbTask<Summary>("payments-summary");
  await expect(page.getByRole("row")).toHaveCount(thisWeekCount + 1); // + header row
  if (thisWeekCount === 0) await expect(page.getByText("Nothing here.")).toBeVisible();
});

test("Remove takes a sponsorship off Payments, paid or not", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/payments?filter=all");
  await paidBox(page).click();
  await expect(paidBox(page)).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => dbTask<PaidState>("sponsorship-paid", sponsorshipId)?.paid).toBe(true);
  const before = dbTask<Summary>("payments-summary");

  await paymentRow(page)
    .getByRole("button", { name: `Remove Jordan Reyes, ${ITEM}, ${label}` })
    .click();
  await expect(paymentRow(page)).toHaveCount(0);
  expect(dbTask<PaidState>("sponsorship-paid", sponsorshipId)).toBeNull();
  await expectTotals(page, { ...before, collectedCents: before.collectedCents - 3000 });
});

test("members get a 403 on Payments and see no Payments link", async ({ page }) => {
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Payments" })).toHaveCount(0);
  const res = await page.goto("/admin/payments");
  expect(res?.status()).toBe(403);
  await expect(page.getByText("Organizers only")).toBeVisible();
  await expect(page.getByText(ITEM)).toHaveCount(0);
});

test("the organizer's nav lists Payments after Thursdays", async ({ page }) => {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/");
  const links = await page.locator("#app-nav a").allTextContents();
  expect(links.indexOf("Payments")).toBe(links.indexOf("Thursdays") + 1);
  await page.getByRole("link", { name: "Payments" }).click();
  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
});

test("phone width: the table scrolls inside its card, not the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/admin/payments?filter=all");
  await expect(paymentRow(page)).toHaveCount(1);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
