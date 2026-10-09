import { expect, test, type Browser, type Page } from "@playwright/test";
import { dbTask, signInAs } from "./helpers";

// M6 — Ordering & kitchen queue (docs/build-plan.md). Uses this Thursday; every test starts
// from no orders + ordering closed, and the original state is restored at the end.

type HomeEvent = { id: string; status: string };
type OrderingState = {
  status: "SCHEDULED" | "ORDERING_OPEN" | "ORDERING_CLOSED";
  orderingEnabled: boolean;
  items: { id: string; name: string; orderable: boolean }[];
};

let eventId: string;
let original: OrderingState;
let item: { id: string; name: string };

test.beforeAll(() => {
  const home = dbTask<HomeEvent>("home-event");
  if (home.status === "SKIPPED" || home.status === "CANCELLED") {
    throw new Error("This Thursday must not be skipped.");
  }
  eventId = home.id;
  original = dbTask<OrderingState>("ordering-state", eventId);
  const orderable = original.items.find((i) => i.orderable);
  if (!orderable) throw new Error("This Thursday needs an orderable menu item.");
  item = orderable;
});

test.beforeEach(() => {
  dbTask("ordering-reset", eventId, JSON.stringify({ status: "SCHEDULED", orderingEnabled: true }));
  dbTask("set-options", item.id);
});

test.afterAll(() => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: original.status, orderingEnabled: original.orderingEnabled }),
  );
  dbTask("set-options", item.id);
});

async function as(browser: Browser, name: string) {
  const page = await browser.newPage();
  await signInAs(page, name);
  return page;
}
const column = (page: Page, label: string) => page.getByRole("region", { name: label });
const card = (page: Page, label: string, who: string) =>
  column(page, label).locator("article", { hasText: who });

test("Chelsea runs a Thursday: opens ordering, member + guest orders to Picked up, closes", async ({
  browser,
}) => {
  const chelsea = await as(browser, "Chelsea Merrill");
  const jordan = await as(browser, "Jordan Reyes"); // no Yes RSVP → walk-in

  // Closed: Home explains, no Place your order.
  await jordan.goto("/");
  await expect(jordan.getByLabel("Your order")).toContainText("Ordering opens when Chelsea");

  await chelsea.goto(`/kitchen/${eventId}`);
  // Open ordering asks for this week's message first (#55); it starts from a template.
  await chelsea.getByRole("button", { name: "Open ordering" }).click();
  const compose = chelsea.getByRole("form", { name: "Open ordering" });
  await expect(compose.getByLabel(/This week's message/)).toHaveValue(/Ordering is open!/);
  await compose
    .getByLabel(/This week's message/)
    .fill("Waffles today! In Customize, pick maple or blueberry syrup.");
  await compose.getByRole("button", { name: /^Open ordering/ }).click();
  await expect(chelsea.getByText("Ordering is open", { exact: true })).toBeVisible();

  // Member orders from Home, and sees Chelsea's message above Customize.
  await jordan.goto("/");
  await jordan.getByRole("link", { name: "Place your order" }).click();
  await expect(jordan.getByRole("region", { name: "From Chelsea" })).toContainText(
    "In Customize, pick maple or blueberry syrup.",
  );
  await jordan.getByRole("button", { name: new RegExp(item.name) }).click();
  await jordan.getByLabel("Customize").fill("Extra syrup");
  await jordan.getByRole("button", { name: "Submit order" }).click();
  // After ordering, members land on the kitchen queue with their order in Placed.
  await expect(jordan).toHaveURL(new RegExp(`/kitchen/${eventId}$`), { timeout: 15_000 });
  await expect(card(jordan, "Placed", "Jordan Reyes")).toBeVisible();
  await jordan.goto("/");
  await expect(jordan.getByLabel("Your order")).toContainText("Placed");

  // Guest walk-in.
  await chelsea.getByLabel("Walk-in name").fill("Client – Acme");
  await chelsea.getByRole("button", { name: "Add", exact: true }).click();
  await expect(card(chelsea, "Placed", "Client – Acme")).toContainText("GUEST");
  await expect(card(chelsea, "Placed", "Jordan Reyes")).toContainText("WALK-IN");
  await expect(card(chelsea, "Placed", "Jordan Reyes")).toContainText("Extra syrup");
  await expect(chelsea.getByLabel("Item totals")).toContainText(`${item.name} × 2`);

  // Run Jordan's order across the board; Home follows.
  await card(chelsea, "Placed", "Jordan Reyes")
    .getByRole("button", { name: /Start cooking/ })
    .click();
  await card(chelsea, "Cooking", "Jordan Reyes")
    .getByRole("button", { name: /Mark ready/ })
    .click();
  await jordan.reload();
  await expect(jordan.getByLabel("Your order")).toContainText("Ready");
  await card(chelsea, "Ready", "Jordan Reyes")
    .getByRole("button", { name: /Picked up/ })
    .click();
  await expect(card(chelsea, "Picked up", "Jordan Reyes")).toBeVisible();

  // And the guest.
  for (const [from, label] of [
    ["Placed", /Start cooking/],
    ["Cooking", /Mark ready/],
    ["Ready", /Picked up/],
  ] as const) {
    await card(chelsea, from, "Client – Acme").getByRole("button", { name: label }).click();
  }
  await expect(card(chelsea, "Picked up", "Client – Acme")).toBeVisible();

  await chelsea.getByRole("button", { name: "Close ordering" }).click();
  await expect(chelsea.getByText("Ordering is closed")).toBeVisible();
  await jordan.reload();
  await expect(jordan.getByLabel("Your order")).toContainText("Picked up");
  await expect(jordan.getByRole("link", { name: "Place your order" })).toHaveCount(0);
});

test("a member changes and cancels their own order while it's Placed", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  const priya = await as(browser, "Priya Nair");
  await priya.goto(`/order/${eventId}`);
  await priya.getByRole("button", { name: new RegExp(item.name) }).click();
  await priya.getByRole("button", { name: "Submit order" }).click();
  await expect(priya).toHaveURL(new RegExp(`/kitchen/${eventId}$`), { timeout: 15_000 });
  await priya.goto("/");
  await expect(priya.getByLabel("Your order")).toContainText("Placed");

  await priya.getByLabel("Your order").getByRole("link", { name: "Change" }).click();
  await priya.getByLabel("Customize").fill("No butter");
  await priya.getByRole("button", { name: "Update order" }).click();
  await expect(priya).toHaveURL(new RegExp(`/kitchen/${eventId}$`), { timeout: 15_000 });
  await priya.goto("/");
  await expect(priya.getByLabel("Your order")).toContainText("Placed");

  await priya.goto(`/order/${eventId}`);
  await priya.getByRole("button", { name: "Cancel my order" }).click();
  await expect(priya.getByRole("link", { name: "Place your order" })).toBeVisible();
});

test("organizer can step an order back and cancel a Placed one", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  const chelsea = await as(browser, "Chelsea Merrill");
  await chelsea.goto(`/kitchen/${eventId}`);
  for (const guest of ["Guest One", "Guest Two"]) {
    await chelsea.getByLabel("Walk-in name").fill(guest);
    await chelsea.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card(chelsea, "Placed", guest)).toBeVisible();
  }
  await card(chelsea, "Placed", "Guest One")
    .getByRole("button", { name: /Start cooking/ })
    .click();
  await card(chelsea, "Cooking", "Guest One").getByRole("button", { name: "← Back" }).click();
  await expect(card(chelsea, "Placed", "Guest One")).toBeVisible();

  await card(chelsea, "Placed", "Guest Two").getByRole("button", { name: "Cancel" }).click();
  await expect(chelsea.locator("article", { hasText: "Guest Two" })).toHaveCount(0);
});

test("walk-in names match members; a member can't get two orders", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  const chelsea = await as(browser, "Chelsea Merrill");
  await chelsea.goto(`/kitchen/${eventId}`);
  await chelsea.getByLabel("Walk-in name").fill("dana ortiz"); // RSVP'd No → walk-in member
  await chelsea.getByRole("button", { name: "Add", exact: true }).click();
  await expect(card(chelsea, "Placed", "Dana Ortiz")).toContainText("WALK-IN");

  await chelsea.getByLabel("Walk-in name").fill("Dana Ortiz");
  await chelsea.getByRole("button", { name: "Add", exact: true }).click();
  await expect(chelsea.getByText("Dana Ortiz already has an order.")).toBeVisible();
});

test("item options are chosen on the order form and shown in the kitchen", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  dbTask("set-options", item.id, "Syrup", "Maple", "Blueberry");
  const jordan = await as(browser, "Jordan Reyes");
  await jordan.goto(`/order/${eventId}`);
  await jordan.getByRole("button", { name: new RegExp(item.name) }).click();
  await jordan.getByRole("radio", { name: "Blueberry" }).click();
  await jordan.getByRole("button", { name: "Submit order" }).click();
  await expect(jordan).toHaveURL(new RegExp(`/kitchen/${eventId}$`), { timeout: 15_000 });
  await jordan.goto("/");
  await expect(jordan.getByLabel("Your order")).toContainText(`${item.name} (Blueberry)`);

  const chelsea = await as(browser, "Chelsea Merrill");
  await chelsea.goto(`/kitchen/${eventId}`);
  await expect(card(chelsea, "Placed", "Jordan Reyes")).toContainText(`${item.name} (Blueberry)`);
});

test("members watch the kitchen read-only", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  const jordan = await as(browser, "Jordan Reyes");
  await jordan.goto(`/kitchen/${eventId}`);
  await expect(jordan.getByText("Ordering is open")).toBeVisible();
  await expect(jordan.getByRole("button", { name: /ordering/i })).toHaveCount(0);
  await expect(jordan.getByLabel("Walk-in name")).toHaveCount(0);
  await expect(jordan.getByText("Only Chelsea moves orders along.")).toBeVisible();
  await expect(jordan.getByRole("link", { name: "Kitchen queue" })).toBeVisible();
});

test("ordering-off Thursdays show no ordering UI", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "SCHEDULED", orderingEnabled: false }),
  );
  const jordan = await as(browser, "Jordan Reyes");
  await jordan.goto("/");
  await expect(jordan.getByLabel("This Thursday")).toBeVisible();
  await expect(jordan.getByLabel("Your order")).toHaveCount(0);
  await jordan.goto(`/order/${eventId}`);
  await expect(jordan.getByText("is RSVP only")).toBeVisible();

  const chelsea = await as(browser, "Chelsea Merrill");
  await chelsea.goto(`/kitchen/${eventId}`);
  await expect(chelsea.getByText("is RSVP only")).toBeVisible();
  await expect(chelsea.getByRole("button", { name: "Open ordering" })).toHaveCount(0);
});

test("organizer deletes a picked-up order (after confirming)", async ({ browser }) => {
  dbTask(
    "ordering-reset",
    eventId,
    JSON.stringify({ status: "ORDERING_OPEN", orderingEnabled: true }),
  );
  const chelsea = await as(browser, "Chelsea Merrill");
  await chelsea.goto(`/kitchen/${eventId}`);
  await chelsea.getByLabel("Walk-in name").fill("Guest Delete");
  await chelsea.getByRole("button", { name: "Add", exact: true }).click();
  for (const [from, label] of [
    ["Placed", /Start cooking/],
    ["Cooking", /Mark ready/],
    ["Ready", /Picked up/],
  ] as const) {
    await card(chelsea, from, "Guest Delete").getByRole("button", { name: label }).click();
  }
  const done = card(chelsea, "Picked up", "Guest Delete");
  await expect(done).toBeVisible();
  // Only Picked-up cards offer Delete.
  await expect(chelsea.getByRole("button", { name: /^Delete / })).toHaveCount(1);

  // Dismissing the confirmation keeps it.
  chelsea.once("dialog", (d) => d.dismiss());
  await done.getByRole("button", { name: "Delete Guest Delete's order" }).click();
  await expect(done).toBeVisible();

  // Confirming deletes it.
  chelsea.once("dialog", (d) => d.accept());
  await done.getByRole("button", { name: "Delete Guest Delete's order" }).click();
  await expect(chelsea.locator("article", { hasText: "Guest Delete" })).toHaveCount(0);

  // Members never see Delete.
  const jordan = await as(browser, "Jordan Reyes");
  await jordan.goto(`/kitchen/${eventId}`);
  await expect(jordan.getByRole("button", { name: /Delete/ })).toHaveCount(0);
});
