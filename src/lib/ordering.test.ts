import { describe, expect, it } from "vitest";
import {
  canCancelFromBoard,
  canCloseOrdering,
  canEditOwnOrder,
  canOpenOrdering,
  canPlaceOrder,
  itemTotals,
  nextStatus,
  orderSummary,
  orderTag,
  previousStatus,
} from "./ordering";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const today = d("2026-10-08");
const event = { date: today, status: "SCHEDULED" as const, orderingEnabled: true };
const open = { ...event, status: "ORDERING_OPEN" as const };

describe("open / close ordering", () => {
  it("opens this Thursday when ordering is on, and reopens after closing", () => {
    expect(canOpenOrdering(event, today)).toBe(true);
    expect(canOpenOrdering({ ...event, status: "ORDERING_CLOSED" }, today)).toBe(true);
  });

  it("never opens ordering-off, skipped, already-open or past Thursdays", () => {
    expect(canOpenOrdering({ ...event, orderingEnabled: false }, today)).toBe(false);
    expect(canOpenOrdering({ ...event, status: "SKIPPED" }, today)).toBe(false);
    expect(canOpenOrdering(open, today)).toBe(false);
    expect(canOpenOrdering(event, d("2026-10-09"))).toBe(false);
  });

  it("closes only when open", () => {
    expect(canCloseOrdering(open)).toBe(true);
    expect(canCloseOrdering(event)).toBe(false);
  });
});

describe("board moves", () => {
  it("advances Placed → Cooking → Ready → Picked up", () => {
    expect(nextStatus("PLACED")).toBe("COOKING");
    expect(nextStatus("COOKING")).toBe("READY");
    expect(nextStatus("READY")).toBe("PICKED_UP");
    expect(nextStatus("PICKED_UP")).toBeNull();
    expect(nextStatus("CANCELLED")).toBeNull();
  });

  it("steps back one", () => {
    expect(previousStatus("PICKED_UP")).toBe("READY");
    expect(previousStatus("COOKING")).toBe("PLACED");
    expect(previousStatus("PLACED")).toBeNull();
  });

  it("cancels only from Placed", () => {
    expect(canCancelFromBoard("PLACED")).toBe(true);
    expect(canCancelFromBoard("COOKING")).toBe(false);
  });
});

describe("member orders", () => {
  it("can be placed while ordering is open, and replaced while still Placed", () => {
    expect(canPlaceOrder(null, open)).toBe(true);
    expect(canPlaceOrder({ status: "PLACED" }, open)).toBe(true);
    expect(canPlaceOrder({ status: "CANCELLED" }, open)).toBe(true);
    expect(canPlaceOrder({ status: "COOKING" }, open)).toBe(false);
    expect(canPlaceOrder(null, event)).toBe(false);
    expect(canPlaceOrder(null, { ...open, orderingEnabled: false })).toBe(false);
  });

  it("can be edited only while Placed and ordering is open", () => {
    expect(canEditOwnOrder({ status: "PLACED" }, open)).toBe(true);
    expect(canEditOwnOrder({ status: "COOKING" }, open)).toBe(false);
    expect(canEditOwnOrder({ status: "PLACED" }, { ...open, status: "ORDERING_CLOSED" })).toBe(
      false,
    );
  });
});

describe("display", () => {
  it("tags guests and members without a Yes RSVP", () => {
    const yes = new Set(["priya"]);
    expect(orderTag({ memberId: null }, yes)).toBe("GUEST");
    expect(orderTag({ memberId: "dana" }, yes)).toBe("WALK-IN");
    expect(orderTag({ memberId: "priya" }, yes)).toBeNull();
  });

  it("summarizes lines with options and quantities", () => {
    expect(
      orderSummary([
        { itemName: "Waffles", quantity: 1, selectedOptions: [] },
        {
          itemName: "Eggs",
          quantity: 2,
          selectedOptions: [{ group: "Style", label: "Scrambled" }],
        },
      ]),
    ).toBe("Waffles, 2× Eggs (Scrambled)");
    expect(orderSummary([{ itemName: "Waffles", quantity: 1, selectedOptions: "junk" }])).toBe(
      "Waffles",
    );
  });

  it("totals items on the board, ignoring cancelled orders", () => {
    const line = (itemName: string, quantity = 1) => ({ itemName, quantity, selectedOptions: [] });
    expect(
      itemTotals([
        { status: "PLACED", lines: [line("Waffles")] },
        { status: "READY", lines: [line("Waffles", 2), line("Eggs")] },
        { status: "CANCELLED", lines: [line("Waffles")] },
      ]),
    ).toEqual([
      { name: "Waffles", qty: 3 },
      { name: "Eggs", qty: 1 },
    ]);
  });
});
