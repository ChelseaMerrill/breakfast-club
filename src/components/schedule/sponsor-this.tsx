"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { sponsorThis, type ActionState } from "@/app/(app)/schedule/actions";
import { VENMO_HANDLE, VENMO_URL } from "@/lib/payment-info";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  itemName: string;
  canSponsor: boolean;
  amountLabel: string; // "$30"
};

const pill =
  "rounded-full border-[3px] border-border bg-primary px-[18px] py-[9px] text-[13px] font-bold uppercase shadow-chunky-sm";

/**
 * *Sponsor this* button and its confirm dialog (design: "Sponsor X" → "You're on the menu").
 * The sponsor is always the person who pressed it (open-questions #52); Chelsea adds anyone
 * else by name on the Schedule. Stays mounted after the item fills up, so the confirmation
 * survives the page refresh.
 */
export function SponsorThis({ eventId, itemName, canSponsor, amountLabel }: Props) {
  const [session, setSession] = useState(0); // remounts the dialog fresh each time it opens
  const [open, setOpen] = useState(false);

  return (
    <>
      {canSponsor && (
        <button
          type="button"
          className={pill}
          onClick={() => {
            setSession((n) => n + 1);
            setOpen(true);
          }}
        >
          Sponsor this
        </button>
      )}
      {open && (
        <SponsorDialog
          key={session}
          eventId={eventId}
          itemName={itemName}
          amountLabel={amountLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function HowToPay() {
  return (
    <>
      Pay with cash or Venmo{" "}
      <a
        href={VENMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-destructive underline underline-offset-2"
      >
        {VENMO_HANDLE}
      </a>
      .
    </>
  );
}

function SponsorDialog({
  eventId,
  itemName,
  amountLabel,
  onClose,
}: Omit<Props, "canSponsor"> & { onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sponsorThis, {});
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(59_35_20/0.6)] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-[min(440px,92vw)] flex-col gap-4 rounded-[14px] border-2 border-border bg-card p-[26px]"
      >
        {state.ok ? (
          <>
            <h2 id={titleId} className="font-heading text-[28px] text-destructive uppercase">
              You&apos;re on the menu
            </h2>
            <p className="text-base">
              Please give Chelsea <b>{amountLabel}</b>. <HowToPay />
            </p>
            <button type="button" autoFocus onClick={onClose} className={cn(pill, "py-3")}>
              Done
            </button>
          </>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <h2 id={titleId} className="font-heading text-[28px] uppercase">
              Sponsor {itemName}
            </h2>
            <input type="hidden" name="eventId" value={eventId} />
            <p className="text-sm">
              Each sponsor gives Chelsea <b>{amountLabel}</b>. If two people sponsor the same
              Thursday, each of you gives {amountLabel}.
            </p>
            <p className="text-[13px] text-muted-foreground">
              <HowToPay />
            </p>
            {state.error && (
              <p role="alert" className="text-sm font-bold text-destructive">
                {state.error}
              </p>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-[24px] border-2 border-border p-3 text-[13px] font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className={cn(pill, "flex-1 p-3 disabled:opacity-50")}
              >
                {pending ? "Saving…" : `Sponsor for ${amountLabel}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
