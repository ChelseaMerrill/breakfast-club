"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setRsvp } from "@/app/(app)/rsvp-actions";
import { cn } from "@/lib/utils";

type Answer = "YES" | "NO";

const OPTIONS: { answer: Answer; label: string }[] = [
  { answer: "YES", label: "I'm in" },
  { answer: "NO", label: "Not this week" },
];

/** I'm in / Not this week (design: Home "This Thursday" card). */
export function RsvpButtons({
  eventId,
  current,
  closedText,
}: {
  eventId: string;
  current: Answer | null;
  closedText: string | null; // e.g. "RSVPs closed Wed 5pm"; null while RSVPs are open
}) {
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const closed = closedText !== null;

  function choose(answer: Answer) {
    setError(null);
    startTransition(async () => {
      setOptimistic(answer);
      const form = new FormData();
      form.set("eventId", eventId);
      form.set("answer", answer);
      const result = await setRsvp(form);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2.5" role="group" aria-label="Your RSVP">
        {OPTIONS.map(({ answer, label }) => {
          const selected = optimistic === answer;
          return (
            <button
              key={answer}
              type="button"
              aria-pressed={selected}
              disabled={closed || pending}
              onClick={() => choose(answer)}
              className={cn(
                "flex-1 cursor-pointer rounded-full border-2 border-border p-3 text-center text-sm font-bold uppercase shadow-chunky-sm",
                selected ? "bg-primary" : "bg-transparent",
                "disabled:cursor-not-allowed disabled:opacity-60",
                pending && "cursor-wait",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      {closed && <p className="text-[13px] text-muted-foreground">{closedText}</p>}
      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
