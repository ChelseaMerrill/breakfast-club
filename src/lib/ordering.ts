// Ordering & kitchen rules (docs/business-rules.md → Ordering, Walk-ins & guests). Pure functions;
// the database side lives in src/lib/kitchen.ts and the server actions.
import type { EventStatus, OrderStatus } from "@/generated/prisma/enums";
import { isUpcoming } from "@/lib/event-lifecycle";

export type OrderingEvent = { date: Date; status: EventStatus; orderingEnabled: boolean };

/** Open ordering (or reopen after closing) — this Thursday only, and only if ordering is on. */
export function canOpenOrdering(event: OrderingEvent, today: Date): boolean {
  return (
    event.orderingEnabled &&
    isUpcoming(event, today) &&
    (event.status === "SCHEDULED" || event.status === "ORDERING_CLOSED")
  );
}

export const canCloseOrdering = (event: OrderingEvent) => event.status === "ORDERING_OPEN";

export const isOrderingOpen = (event: OrderingEvent) =>
  event.orderingEnabled && event.status === "ORDERING_OPEN";

/** The board flow (decision: organizer-only). Cancelled orders are off the board. */
export const BOARD: OrderStatus[] = ["PLACED", "COOKING", "READY", "PICKED_UP"];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = BOARD.indexOf(status);
  return i >= 0 && i < BOARD.length - 1 ? BOARD[i + 1] : null;
}

export function previousStatus(status: OrderStatus): OrderStatus | null {
  const i = BOARD.indexOf(status);
  return i > 0 ? BOARD[i - 1] : null;
}

/** Design: only Placed cards offer Cancel. */
export const canCancelFromBoard = (status: OrderStatus) => status === "PLACED";

/** A member can change or cancel their own order while it's Placed and ordering is open. */
export const canEditOwnOrder = (order: { status: OrderStatus }, event: OrderingEvent) =>
  order.status === "PLACED" && isOrderingOpen(event);

/** A member can (re)place an order when ordering is open and they have no live order beyond Placed. */
export function canPlaceOrder(
  existing: { status: OrderStatus } | null,
  event: OrderingEvent,
): boolean {
  if (!isOrderingOpen(event)) return false;
  return !existing || existing.status === "PLACED" || existing.status === "CANCELLED";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: "Placed",
  COOKING: "Cooking",
  READY: "Ready",
  PICKED_UP: "Picked up",
  CANCELLED: "Cancelled",
};

/** Kitchen card tag (design): GUEST for guests, WALK-IN for members without a Yes RSVP. */
export function orderTag(order: { memberId: string | null }, yesMemberIds: Set<string>) {
  if (order.memberId === null) return "GUEST" as const;
  return yesMemberIds.has(order.memberId) ? null : ("WALK-IN" as const);
}

export type SelectedOption = { group: string; label: string };
export type LineSummary = { itemName: string; quantity: number; selectedOptions: unknown };

function options(value: unknown): SelectedOption[] {
  return Array.isArray(value)
    ? value.filter(
        (o): o is SelectedOption =>
          !!o && typeof o.group === "string" && typeof o.label === "string",
      )
    : [];
}

/** "Waffles", "Eggs (Scrambled)", "2× Bacon". */
export function orderSummary(lines: LineSummary[]): string {
  return lines
    .map((l) => {
      const opts = options(l.selectedOptions).map((o) => o.label);
      return `${l.quantity > 1 ? `${l.quantity}× ` : ""}${l.itemName}${opts.length ? ` (${opts.join(", ")})` : ""}`;
    })
    .join(", ");
}

/** Item totals for the kitchen ("Waffles × 4"), from orders still on the board. */
export function itemTotals(orders: { status: OrderStatus; lines: LineSummary[] }[]) {
  const totals = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "CANCELLED") continue;
    for (const l of o.lines) totals.set(l.itemName, (totals.get(l.itemName) ?? 0) + l.quantity);
  }
  return [...totals].map(([name, qty]) => ({ name, qty }));
}
