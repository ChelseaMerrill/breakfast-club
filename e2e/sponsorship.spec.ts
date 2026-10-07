import { expect, test, type Page } from "@playwright/test";
import { formatShortThursday } from "../src/lib/thursdays";
import { dbTask, signInAs } from "./helpers";

// M4 — Menu & sponsorship (docs/build-plan.md). Uses the furthest-out Thursday with no menu, so
// seed weeks stay untouched, and removes its menu item and sponsorships after each test.

type Target = { id: string; date: string; sponsorsNeeded: number };
type MenuState = { sponsorsNeeded: number; items: { name: string; sponsorships: number }[] };

let target: Target;
let label: string;

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

test.afterEach(() => {
  dbTask("reset-menu", target.id, String(target.sponsorsNeeded));
});

const card = (page: Page) =>
  page.locator("article").filter({ has: page.getByRole("heading", { name: label, exact: true }) });

/** As Chelsea: set the target Thursday's menu item (and optionally sponsors needed). */
async function chelseaSetsMenu(page: Page, item: string, sponsorsNeeded = 1) {
  await signInAs(page, "Chelsea Merrill");
  await page.goto("/schedule");
  const c = card(page);
  await expect(c).toContainText("No menu yet");
  const box = c.getByLabel(`Menu item for ${label}`);
  await box.fill(item);
  await box.press("Enter");
  await expect(c.getByRole("paragraph").filter({ hasText: item })).toBeVisible();
  for (let n = 1; n < sponsorsNeeded; n++) {
    await c.getByRole("button", { name: `More sponsors needed for ${label}` }).click();
    await expect(c).toContainText(`${n + 1} sponsors needed`);
  }
}

async function openSponsorModal(page: Page) {
  await card(page).getByRole("button", { name: "Sponsor this" }).click();
  return page.getByRole("dialog");
}

test("Chelsea sets a menu item and a member's name appears next to it", async ({ page }) => {
  await chelseaSetsMenu(page, "E2E Waffles");
  await expect(card(page)).toContainText("Needs 1 sponsor ($30 each)");

  await signInAs(page, "Jordan Reyes");
  await page.goto("/schedule");
  const dialog = await openSponsorModal(page);
  await expect(dialog).toContainText("Sponsor E2E Waffles");
  await expect(dialog.getByRole("button", { name: "Just me" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("You're on the menu");
  await expect(dialog).toContainText("Please pay $30 to Chelsea.");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  // The cap (1 sponsor needed) is filled, so Sponsor this is gone.
  await expect(card(page)).toContainText("Sponsored by Jordan Reyes");
  await expect(card(page).getByRole("button", { name: "Sponsor this" })).toHaveCount(0);
  expect(dbTask<MenuState>("menu-state", target.id).items).toEqual([
    { name: "E2E Waffles", sponsorships: 1 },
  ]);
});

test("Sponsor this: Me + someone and A team, until the cap hides it", async ({ page }) => {
  await chelseaSetsMenu(page, "E2E Quiche", 2);

  await signInAs(page, "Jordan Reyes");
  await page.goto("/schedule");
  let dialog = await openSponsorModal(page);
  await dialog.getByRole("button", { name: "Me + someone" }).click();
  await dialog.getByLabel("Coworker").selectOption({ label: "Jane Doe" });
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("You're on the menu");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(card(page)).toContainText("Sponsored by Jordan Reyes & Jane Doe · needs 1 more");

  // Signing up again as a team while already on it is refused...
  dialog = await openSponsorModal(page);
  await dialog.getByRole("button", { name: "A team" }).click();
  await expect(dialog.getByRole("button", { name: "Confirm" })).toBeDisabled();
  await dialog.getByLabel("Team name").fill("Delivery team");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("You're already sponsoring E2E Quiche.");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // ...so Sam signs up the team, which fills the second spot.
  await signInAs(page, "Sam Lee");
  await page.goto("/schedule");
  dialog = await openSponsorModal(page);
  await dialog.getByRole("button", { name: "A team" }).click();
  await dialog.getByLabel("Team name").fill("Delivery team");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("You're on the menu");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(card(page)).toContainText("Sponsored by Jordan Reyes & Jane Doe, Delivery team");
  await expect(card(page).getByRole("button", { name: "Sponsor this" })).toHaveCount(0);

  // Jane (the "someone") sees it in her sponsorships too.
  await signInAs(page, "Jane Doe");
  await page.goto("/");
  const mine = page.getByRole("region", { name: "My sponsorships" });
  await expect(mine.getByRole("listitem").filter({ hasText: label })).toContainText(
    "E2E Quiche · Jordan Reyes & Jane Doe",
  );
});

test("a member removes their own unpaid sponsorship from Home", async ({ page }) => {
  await chelseaSetsMenu(page, "E2E Bagels");
  await signInAs(page, "Jordan Reyes");
  await page.goto("/schedule");
  const dialog = await openSponsorModal(page);
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog).toContainText("You're on the menu");

  await page.goto("/");
  const mine = page.getByRole("region", { name: "My sponsorships" });
  const row = mine.getByRole("listitem").filter({ hasText: label });
  await expect(row).toContainText("E2E Bagels · Jordan Reyes");
  await expect(row).toContainText("$30 due");
  await row.getByRole("button", { name: /^Remove E2E Bagels sponsorship/ }).click();
  await expect(row).toHaveCount(0);

  // Sponsor this is back on the Schedule.
  await page.goto("/schedule");
  await expect(card(page)).toContainText("Needs 1 sponsor ($30 each)");
  await expect(card(page).getByRole("button", { name: "Sponsor this" })).toBeVisible();
});

test("Chelsea adds a sponsor by name, renames the item, and removes the sponsor", async ({
  page,
}) => {
  await chelseaSetsMenu(page, "E2E Pancakes");
  const c = card(page);

  // Add a non-member by name.
  await c.getByLabel(`Add sponsor by name for ${label}`).fill("Client – Acme");
  await c.getByRole("button", { name: "Add" }).click();
  await expect(c).toContainText("Sponsored by Client – Acme");

  // Full now: adding another is refused until sponsors needed goes up.
  await c.getByLabel(`Add sponsor by name for ${label}`).fill("Fred Again");
  await c.getByRole("button", { name: "Add" }).click();
  await expect(c.getByRole("alert")).toContainText("Already fully sponsored");
  await expect(
    c.getByRole("button", { name: `Fewer sponsors needed for ${label}` }),
  ).toBeDisabled();
  await c.getByRole("button", { name: `More sponsors needed for ${label}` }).click();
  await expect(c).toContainText("2 sponsors needed");
  await expect(c).toContainText("Sponsored by Client – Acme · needs 1 more");

  // Renaming keeps the sponsorships.
  const box = c.getByLabel(`Menu item for ${label}`);
  await box.fill("E2E Crepes");
  await box.press("Enter");
  await expect(c.getByRole("paragraph").filter({ hasText: "E2E Crepes" })).toBeVisible();
  await expect(c).toContainText("Sponsored by Client – Acme · needs 1 more");

  // Organizer removes the sponsor.
  await c.getByRole("button", { name: "Remove Client – Acme" }).click();
  await expect(c).toContainText("Needs 2 sponsors ($30 each)");
  expect(dbTask<MenuState>("menu-state", target.id)).toEqual({
    sponsorsNeeded: 2,
    items: [{ name: "E2E Crepes", sponsorships: 0 }],
  });
});

test("members can't use the organizer's menu controls", async ({ page, browser }) => {
  // Chelsea's page carries the server action for "+" (sponsors needed).
  await chelseaSetsMenu(page, "E2E Omelettes");
  const html = await page.content();
  const plusForm = card(page).locator("form", {
    has: page.getByRole("button", { name: `More sponsors needed for ${label}` }),
  });
  const actionField = await plusForm.locator('input[name^="$ACTION_ID_"]').getAttribute("name");
  expect(actionField, "progressively enhanced form should carry its action id").toBeTruthy();
  expect(html).toContain(actionField!);

  // Jordan sees no organizer controls...
  const member = await browser.newPage();
  await signInAs(member, "Jordan Reyes");
  await member.goto("/schedule");
  await expect(card(member)).toContainText("E2E Omelettes");
  await expect(card(member).getByLabel(`Menu item for ${label}`)).toHaveCount(0);
  await expect(
    card(member).getByRole("button", { name: `More sponsors needed for ${label}` }),
  ).toHaveCount(0);
  await expect(card(member).getByLabel(`Add sponsor by name for ${label}`)).toHaveCount(0);

  // ...and posting the organizer's action directly is refused on the server.
  const res = await member.request.post("/schedule", {
    multipart: { [actionField!]: "", eventId: target.id, delta: "1" },
    maxRedirects: 0,
  });
  // requireOrganizer() calls forbidden(); for a no-JS action POST Next answers with an error
  // page (404 in dev) rather than running the action.
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(dbTask<MenuState>("menu-state", target.id).sponsorsNeeded).toBe(target.sponsorsNeeded);
  await member.close();
});

test("Home Menu card shows this Thursday's item and links to the Schedule", async ({ page }) => {
  const home = dbTask<{ status: string; item: string | null } | null>("home-menu");
  await signInAs(page, "Jordan Reyes");
  await page.goto("/");
  const menu = page.getByRole("region", { name: "Menu" });
  if (home?.status === "SKIPPED") await expect(menu).toContainText("No breakfast");
  else await expect(menu).toContainText(home?.item ?? "No menu yet");
  await menu.getByRole("link", { name: "Sponsor an item →" }).click();
  await expect(page).toHaveURL(/\/schedule$/);
});
