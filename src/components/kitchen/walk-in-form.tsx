"use client";

import { useActionState, useEffect, useRef } from "react";
import { addWalkIn, type KitchenState } from "@/app/(app)/kitchen/actions";

const field = "rounded-[14px] border-[3px] border-border bg-white p-2.5 text-sm text-foreground";

/** + Walk-in: a name (members suggested as you type; anything else is a guest) and an item. */
export function WalkInForm({
  eventId,
  items,
  members,
}: {
  eventId: string;
  items: { id: string; name: string }[];
  members: string[];
}) {
  const [state, action, pending] = useActionState<KitchenState, FormData>(addWalkIn, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={action}
      className="flex flex-wrap items-center gap-2 rounded-[18px] border-[3px] border-border bg-card px-4 py-3 shadow-chunky"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <span className="text-[13px] font-bold uppercase">+ Walk-in</span>
      <input
        name="name"
        list="walk-in-members"
        placeholder="Member or guest name, e.g. Client – Acme"
        aria-label="Walk-in name"
        autoComplete="off"
        required
        className={`${field} min-w-[200px] flex-1`}
      />
      <datalist id="walk-in-members">
        {members.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <select name="menuItemId" aria-label="Walk-in item" className={field} required>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending || items.length === 0}
        className="cursor-pointer rounded-full border-[3px] border-border bg-secondary px-5 py-2.5 text-[13px] font-bold uppercase shadow-chunky-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-[13px] text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
