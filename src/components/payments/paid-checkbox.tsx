"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setSponsorshipPaid } from "@/app/(app)/admin/payments/actions";
import { cn } from "@/lib/utils";

/** The Payments *Paid* checkbox (design: round yellow box with ✓). Flips at once; the server re-checks. */
export function PaidCheckbox({
  sponsorshipId,
  paid,
  label,
}: {
  sponsorshipId: string;
  paid: boolean;
  label: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(paid);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const form = new FormData();
      form.set("sponsorshipId", sponsorshipId);
      form.set("paid", String(next));
      const result = await setSponsorshipPaid(form);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        role="checkbox"
        aria-checked={optimistic}
        aria-label={label}
        aria-busy={pending || undefined}
        onClick={toggle}
        className={cn(
          "flex size-[22px] cursor-pointer items-center justify-center rounded-[14px] border-2 border-border text-sm leading-none font-black text-foreground",
          optimistic ? "bg-primary" : "bg-transparent",
        )}
      >
        {optimistic ? "✓" : ""}
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-[11px] text-destructive">
          {error}
        </span>
      )}
    </>
  );
}
