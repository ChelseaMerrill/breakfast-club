"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { skipThursday } from "@/app/(app)/admin/events/actions";

const chip =
  "cursor-pointer rounded-[20px] border-2 border-border px-3.5 py-2 text-xs font-bold uppercase disabled:cursor-wait disabled:opacity-60";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${chip} bg-primary text-foreground`}>
      {pending ? "Skipping…" : "Confirm"}
    </button>
  );
}

/** Skip button that asks for a reason first (default "Holiday"). */
export function SkipControl({ eventId, dateLabel }: { eventId: string; dateLabel: string }) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={`${chip} text-muted-foreground`}
      >
        Skip
      </button>
    );
  }

  return (
    <form action={skipThursday} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="sr-only" htmlFor={`reason-${eventId}`}>
        Reason for skipping {dateLabel}
      </label>
      <input
        id={`reason-${eventId}`}
        name="reason"
        defaultValue="Holiday"
        maxLength={80}
        autoFocus
        className="w-36 rounded-[14px] border-[3px] border-border bg-white px-3 py-1.5 text-sm text-foreground"
      />
      <ConfirmButton />
      <button
        type="button"
        onClick={() => setAsking(false)}
        className={`${chip} text-muted-foreground`}
      >
        Cancel
      </button>
    </form>
  );
}
