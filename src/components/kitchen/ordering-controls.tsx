"use client";

import { useActionState, useState } from "react";
import { closeOrdering, openOrdering, type OpenOrderingState } from "@/app/(app)/kitchen/actions";
import { ORDERING_MESSAGE_MAX, defaultOrderingMessage } from "@/lib/ordering-post";
import { cn } from "@/lib/utils";

const big =
  "cursor-pointer rounded-full border-[3px] border-border px-7 py-3.5 font-bold uppercase shadow-chunky-sm disabled:cursor-wait disabled:opacity-60";

/**
 * Open / Close ordering for the organizer. Opening asks for this week's message first
 * (posted to #108state if ticked, and shown on the order form) — open-questions #55.
 * Stays mounted across the refresh so the result ("Posted to #108state") remains visible.
 */
export function OrderingControls({
  eventId,
  open,
  canOpen,
  itemName,
  savedMessage,
  everOpened,
  slackConnected,
}: {
  eventId: string;
  open: boolean;
  canOpen: boolean;
  itemName: string | null;
  savedMessage: string | null;
  everOpened: boolean;
  slackConnected: boolean;
}) {
  const [state, action, pending] = useActionState<OpenOrderingState, FormData>(openOrdering, {});
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState(savedMessage ?? defaultOrderingMessage(itemName));
  // Post the first time ordering opens each Thursday; a reopen defaults to not posting again.
  const [post, setPost] = useState(slackConnected && !everOpened);

  // When ordering opens or closes, start the next "Open ordering" fresh: box hidden, and
  // Post re-defaulted (a reopen after the first open is unticked, so it can't double-post).
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    setComposing(false);
    setPost(slackConnected && !everOpened);
  }

  const result =
    state.ok &&
    (state.posted
      ? "Ordering is open and the message was posted to #108state."
      : state.slackError
        ? `Ordering is open, but the Slack post didn't go out: ${state.slackError}`
        : "Ordering is open. Nothing was posted to Slack.");

  if (open) {
    return (
      <div className="flex flex-col gap-2">
        <form action={closeOrdering}>
          <input type="hidden" name="eventId" value={eventId} />
          <button type="submit" className={cn(big, "bg-[#FFB4A2]")}>
            Close ordering
          </button>
        </form>
        {result && (
          <p role="status" className={cn("text-[13px]", state.slackError && "text-destructive")}>
            {result}
          </p>
        )}
      </div>
    );
  }
  if (!canOpen) return null;

  if (!composing) {
    return (
      <button type="button" onClick={() => setComposing(true)} className={cn(big, "bg-primary")}>
        Open ordering
      </button>
    );
  }

  return (
    <form
      action={action}
      aria-label="Open ordering"
      className="flex w-full flex-col gap-3 rounded-[18px] border-[3px] border-border bg-card p-4 shadow-chunky"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor="ordering-message" className="text-sm font-bold">
        This week&apos;s message
        <span className="block text-xs font-normal text-muted-foreground">
          Tell everyone what to put in Customize today. It&apos;s shown on the order form
          {slackConnected ? " and can be posted to #108state." : "."}
        </span>
      </label>
      <textarea
        id="ordering-message"
        name="message"
        rows={4}
        maxLength={ORDERING_MESSAGE_MAX}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="rounded-[14px] border-[3px] border-border bg-white p-3 text-sm text-foreground"
      />
      <label
        className={cn(
          "flex items-center gap-2 text-sm",
          slackConnected ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="checkbox"
          name="post"
          checked={post}
          disabled={!slackConnected}
          onChange={(e) => setPost(e.target.checked)}
          className="size-4 accent-[var(--bc-red)]"
        />
        Post to #108state
        {!slackConnected && (
          <span className="text-xs text-muted-foreground">(Slack isn&apos;t connected)</span>
        )}
        {slackConnected && everOpened && (
          <span className="text-xs text-muted-foreground">(you already opened today once)</span>
        )}
      </label>
      {state.error && (
        <p role="alert" className="text-[13px] font-bold text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={pending} className={cn(big, "bg-primary")}>
          {pending ? "Opening…" : post ? "Open ordering & post" : "Open ordering"}
        </button>
        <button
          type="button"
          onClick={() => setComposing(false)}
          className="cursor-pointer rounded-full border-2 border-border px-5 py-2.5 text-[13px] font-bold uppercase"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
