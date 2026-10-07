"use client";

import { useActionState, useRef } from "react";
import { addSponsorByName, saveMenuItem, type ActionState } from "@/app/(app)/schedule/actions";

const field =
  "rounded-[14px] border-[3px] border-border bg-white px-3 py-2 text-sm text-foreground disabled:opacity-60";

function ErrorText({ error }: { error?: string }) {
  return error ? (
    <p role="alert" className="w-full text-xs font-bold text-destructive">
      {error}
    </p>
  ) : null;
}

/** The organizer's inline menu item box. Saves on Enter or when it loses focus. */
export function MenuItemEditor({
  eventId,
  name,
  dateLabel,
}: {
  eventId: string;
  name: string;
  dateLabel: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveMenuItem, {});
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action} className="contents">
      <input type="hidden" name="eventId" value={eventId} />
      <input
        // Reset to the saved name whenever it changes on the server.
        key={name}
        name="name"
        defaultValue={name}
        placeholder="Menu item"
        aria-label={`Menu item for ${dateLabel}`}
        maxLength={60}
        readOnly={pending}
        onBlur={(e) => {
          if (!pending && e.currentTarget.value.trim() !== name) formRef.current?.requestSubmit();
        }}
        className={`${field} w-[180px]`}
      />
      <ErrorText error={state.error} />
    </form>
  );
}

/** "Add sponsor by name (non-member)" + Add. */
export function AddSponsorByName({ eventId, dateLabel }: { eventId: string; dateLabel: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addSponsorByName, {});

  return (
    <form action={action} className="flex w-full flex-wrap gap-1.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input
        name="sponsorName"
        placeholder="Add sponsor by name (non-member)"
        aria-label={`Add sponsor by name for ${dateLabel}`}
        maxLength={60}
        required
        className={`${field} min-w-0 flex-1`}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border-[3px] border-border bg-secondary px-4 py-2 text-[13px] font-bold uppercase disabled:opacity-60"
      >
        Add
      </button>
      <ErrorText error={state.error} />
    </form>
  );
}
