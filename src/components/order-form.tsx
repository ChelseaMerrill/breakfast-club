"use client";

import { useActionState, useState } from "react";
import { placeOrder, type OrderState } from "@/app/(app)/order/actions";
import { PillButton } from "@/components/bc";
import { cn } from "@/lib/utils";

export type OrderFormItem = {
  id: string;
  name: string;
  description: string | null;
  optionGroups: { group: string; labels: string[] }[];
};

type Choice = Record<string, string>; // group → label
type Selection = Record<string, Choice>; // menuItemId → choice

/** Design: "Place your order" — tap an item to add it, pick its options, add notes, submit. */
export function OrderForm({
  eventId,
  items,
  initial,
  initialNotes,
  editing,
}: {
  eventId: string;
  items: OrderFormItem[];
  initial: Selection;
  initialNotes: string;
  editing: boolean;
}) {
  const [state, action, pending] = useActionState<OrderState, FormData>(placeOrder, {});
  const [selection, setSelection] = useState<Selection>(initial);
  const chosen = Object.keys(selection).length;

  function toggle(item: OrderFormItem) {
    setSelection((s) => {
      const next = { ...s };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = Object.fromEntries(item.optionGroups.map((g) => [g.group, g.labels[0]]));
      return next;
    });
  }

  function pick(itemId: string, group: string, label: string) {
    setSelection((s) => ({ ...s, [itemId]: { ...s[itemId], [group]: label } }));
  }

  const payload = JSON.stringify(
    Object.entries(selection).map(([menuItemId, options]) => ({ menuItemId, options })),
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="items" value={payload} />

      {items.map((item) => {
        const choice = selection[item.id];
        return (
          <div
            key={item.id}
            className={cn(
              "flex flex-col gap-2.5 rounded-[18px] border-[3px] bg-card px-5 py-4 shadow-chunky",
              choice ? "border-[#FF5E5B]" : "border-border",
            )}
          >
            <button
              type="button"
              aria-pressed={!!choice}
              onClick={() => toggle(item)}
              className="flex cursor-pointer justify-between text-left"
            >
              <span>
                <span className="text-base font-bold">{item.name}</span>
                {item.description && (
                  <span className="block text-[13px] text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </span>
              <span className="font-bold text-destructive">{choice ? "Added ✓" : "Add"}</span>
            </button>
            {choice &&
              item.optionGroups.map((g) => (
                <div
                  key={g.group}
                  role="radiogroup"
                  aria-label={`${item.name} ${g.group}`}
                  className="flex flex-wrap gap-2"
                >
                  {g.labels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={choice[g.group] === label}
                      onClick={() => pick(item.id, g.group, label)}
                      className={cn(
                        "cursor-pointer rounded-full border-2 border-border px-3.5 py-1.5 text-[13px]",
                        choice[g.group] === label ? "bg-primary" : "bg-transparent",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        );
      })}

      <textarea
        name="notes"
        defaultValue={initialNotes}
        maxLength={300}
        placeholder="Notes (allergies, no cheese...)"
        aria-label="Notes"
        rows={2}
        className="rounded-[14px] border-[3px] border-border bg-white p-3 text-sm text-foreground"
      />

      {state.error && (
        <p role="alert" className="text-[13px] text-destructive">
          {state.error}
        </p>
      )}
      <PillButton type="submit" disabled={pending || chosen === 0} className="w-full">
        {pending ? "Sending…" : editing ? "Update order" : "Submit order"}
      </PillButton>
    </form>
  );
}
