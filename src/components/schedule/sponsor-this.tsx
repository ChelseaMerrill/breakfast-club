"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { sponsorThis, type ActionState } from "@/app/(app)/schedule/actions";
import { cn } from "@/lib/utils";

type Coworker = { id: string; name: string };
type Props = {
  eventId: string;
  itemName: string;
  canSponsor: boolean;
  coworkers: Coworker[];
  amountLabel: string; // "$30"
};

const MODES = [
  ["me", "Just me"],
  ["two", "Me + someone"],
  ["team", "A team"],
] as const;
type Mode = (typeof MODES)[number][0];

const pill =
  "rounded-full border-[3px] border-border bg-primary px-[18px] py-[9px] text-[13px] font-bold uppercase shadow-chunky-sm";
const field = "rounded-[14px] border-[3px] border-border bg-white p-[11px] text-foreground";

/**
 * *Sponsor this* button and its modal (design: "Sponsor X" → "You're on the menu").
 * Stays mounted after the item fills up, so the confirmation survives the page refresh.
 */
export function SponsorThis({ eventId, itemName, canSponsor, coworkers, amountLabel }: Props) {
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
          coworkers={coworkers}
          amountLabel={amountLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function SponsorDialog({
  eventId,
  itemName,
  coworkers,
  amountLabel,
  onClose,
}: Omit<Props, "canSponsor"> & { onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(sponsorThis, {});
  const [mode, setMode] = useState<Mode>("me");
  const [teamName, setTeamName] = useState("");
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
            <p className="text-base">Please pay {amountLabel} to Chelsea.</p>
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
            <input type="hidden" name="mode" value={mode} />
            <div className="flex gap-2" role="group" aria-label="Who's sponsoring">
              {MODES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex-1 rounded-full border-2 border-border px-1 py-2.5 text-xs font-bold uppercase",
                    mode === value ? "bg-primary" : "bg-transparent",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "two" && (
              <select name="partnerId" required className={field} aria-label="Coworker">
                {coworkers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {mode === "team" && (
              <input
                name="teamName"
                aria-label="Team name"
                placeholder="Team name, e.g. Delivery team"
                maxLength={60}
                required
                autoFocus
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={field}
              />
            )}
            <p className="text-[13px] text-muted-foreground">
              One sponsorship is {amountLabel} paid to Chelsea, even when two people share it.
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
                disabled={pending || (mode === "team" && !teamName.trim())}
                className={cn(pill, "flex-1 p-3 disabled:opacity-50")}
              >
                {pending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
