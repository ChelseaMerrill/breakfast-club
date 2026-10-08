# Build Plan

Build in this order. Each milestone should be working end-to-end before starting the next.
Paste one milestone at a time into Claude Code: *"Implement Milestone N from docs/build-plan.md."*

## M0 — Scaffold
- Next.js + TS + Tailwind + shadcn/ui, Prisma + Neon Postgres (Neon `dev` branch locally), ESLint/Prettier, Vitest
- Schema from `docs/data-model.md`; dev-only seed script with 4 upcoming Thursdays and the design's sample menu
- **Done when:** `npm run dev` shows a placeholder home page and `db:seed` fills the dev database.

## M1 — Auth & roles
- **Sign in with Slack** via Auth.js — the only sign-in (open-questions #42); create/update the Member on login
- Only #108state members may sign in (`conversations.members`), re-checked every few hours
- `ORGANIZER_SLACK_IDS` grants ORGANIZER (Chelsea); no role toggle
- Off until the Slack app exists (`AUTH_SLACK_ID`/`AUTH_SLACK_SECRET`); a Google stand-in (#41) was built and later removed
- Local-dev-only "Sign in as…" picker of seed members
- Server-side role guard for `/admin/*`
- **Done when:** a #108state member can sign in with Slack, someone outside the channel can't, Chelsea's Slack account gets the organizer pages, and non-organizers get 403 on admin routes. (Verified with the dev picker and mocked Slack; real Slack check once the app exists.)

## M2 — Schedule & skip weeks
- `/schedule` list of Thursdays
- `/admin/events` (*Thursdays*): top up to 8 Thursdays ahead on load, *Add next Thursday*, Skip (with reason) / Restore, toggle *Ordering enabled*
- Midnight-NY rollover: events become `COMPLETED`; forgotten-open ordering auto-closes with a note (runs on page load — `syncThursdays()` in `src/lib/events.ts`)
- App shell: the design's left nav (hamburger on phones)
- Playwright end-to-end tests start here (pulled forward from M3)
- **Done when:** Chelsea skips a Thursday and it shows faded on the Schedule as "No breakfast: <reason>".

## M3 — RSVP & headcount
- Home card with Yes/No; names of who's in/out and headcount visible to everyone
- RSVP deadline (Wednesday 5pm ET) enforced — buttons disabled with "RSVPs closed Wed 5pm"; the organizer can still change her own RSVP (not other people's — open-questions #43)
- End-to-end test covers RSVP
- Implementation: rules in `src/lib/rsvp.ts` (deadline from settings, DST-safe; organizer exempt; headcount = Yes + walk-ins/guests); Home card `src/components/home/this-thursday-card.tsx`; action `src/app/(app)/rsvp-actions.ts`
- Skipped/cancelled Thursday on Home: banner + next breakfast date instead of RSVP buttons
- **Done when:** two members RSVP and both see each other's names and the count; edits are blocked after the deadline.

## M4 — Menu & sponsorship
- On `/schedule`, the organizer types each Thursday's **menu item**, sets **sponsors needed** (−/+), and can **add a sponsor by name**
- Any member: *Sponsor this* (hidden once filled) → confirm → "You're on the menu. Please give Chelsea $30. Pay with cash or Venmo @Chelsea-Merrill-1."; remove own unpaid sponsorship from Home (originally Just me / Me + someone / A team — removed, open-questions #52)
- Home *Menu* card shows the item and "Sponsored by …" / "Needs N sponsor(s) ($30 each)"
- **Done when:** Chelsea sets a menu item and a member's name (or team) appears next to it.
- Built (notes):
  - Rules are pure functions in `src/lib/sponsorship-rules.ts` (unit-tested); actions in `src/app/(app)/schedule/actions.ts` lock the Thursday's row (`SELECT … FOR UPDATE`) before counting sponsorships, so two people can't take the last spot.
  - Menu item box saves on Enter/blur; emptying it removes the item only if it has no sponsors or orders. Renaming keeps sponsorships (they point at the item).
  - Sponsors needed: 1–10, and − stops at the number of sponsorships already on the item.
  - The organizer's *Add sponsor by name* respects the cap too ("Already fully sponsored. Press + …"). She removes any sponsor with the × on its chip on the Schedule (Payments, M5, will also list them).
  - (Retired) *A team* / *Me + someone*: removed in #52. `teamName` and multi-member sponsorships stay readable for old rows; new ones are always one member or one typed name.
  - A member can't be on two sponsorships of the same item ("You're already sponsoring …").
  - Organizer controls are hidden on skipped/cancelled Thursdays (the design shows them on every card; there's nothing to sponsor on a skipped week).
  - Home: `src/components/home/menu-card.tsx` (first Thursday from today) and `my-sponsorships-card.tsx` (upcoming sponsorships plus past unpaid ones, each with its Thursday's date).

## M5 — Payments
- `/admin/payments`: all sponsorships with Paid checkbox, filters (unpaid / this week / all), totals collected and outstanding
- Members see *$30 due* / *Paid ✓* on their own sponsorships
- **Done when:** Chelsea checks off a sponsorship and the sponsor sees *Paid ✓*.
- Notes (as built):
  - Lists every Sponsorship on every Thursday (past, upcoming, skipped or cancelled), Thursday ascending, then sign-up order. Columns as in the design: Thursday · Item · Sponsor · Amount · Paid · Remove; "Nothing here." when a filter is empty.
  - Filters live in the URL so they're linkable: `/admin/payments` (*Unpaid*, the default), `?filter=week` (*This week* = the Thursday Home shows: first from today in New York, paid or not), `?filter=all`.
  - *Collected* / *Outstanding* are over **all** sponsorships whatever the filter (as in the design), each summing its own `amountCents`.
  - The *Paid* checkbox flips at once (optimistic) and calls an organizer-only action that sets `paid` and `paidAt` (unchecking clears `paidAt`; a repeat click keeps the original). *Remove* reuses the Schedule's `removeSponsorship` (the organizer can remove any sponsorship, paid or not).
  - Members: Home → *My sponsorships* shows *Paid ✓* and hides *Remove* once paid. Payment status appears nowhere else (Schedule and Home menu cards show names only).
  - Code: `src/app/(app)/admin/payments/`, `src/components/payments/paid-checkbox.tsx`, `src/lib/payments.ts` (pure rules), `listPayments()` in `src/lib/sponsorships.ts`.

## M6 — Ordering & kitchen queue
- Organizer **Open ordering / Close ordering** (no timers); reopen allowed
- `/order/[eventId]`: order builder from orderable items; walk-in if no Yes RSVP
- `/kitchen/[id]`: Placed / Cooking / Ready / Picked up columns; everyone can watch, only the organizer can tap to advance / *← Back* / *Cancel*; animated cooking scene while ordering is open
- **+ Walk-in**: name box suggests members as you type; anything else becomes a guest
- Member home shows live order status (5s polling)
- **Done when:** Chelsea opens ordering, takes member + guest orders, runs them to Picked up, and closes ordering. Ordering-off Thursdays show no ordering UI.
- As built: rules in `src/lib/ordering.ts`, data in `src/lib/kitchen.ts`; kitchen actions `src/app/(app)/kitchen/actions.ts`, member order actions `src/app/(app)/order/actions.ts`; Home card `src/components/home/your-order-card.tsx`; cooking scenes generated from the design (`src/components/kitchen/cooking-art.ts`), paused for reduced motion. Nav: *Place order* and *Kitchen queue* point at this Thursday. The order form is keyed on the order's version because Next keeps recent pages alive (Activity).

## M7 — Slack Tuesday reminder
- `/api/cron/weekly-reminder` with CRON_SECRET, two Tuesday crons (14:00 + 15:00 UTC), at-or-after-10am NY check, `reminderSentAt` guard
- Message lists menu items with sponsors and items still needing one
- Skips SKIPPED/CANCELLED Thursdays and when reminders are off
- `vercel.json` cron config; wire up the *Send test reminder* button (already on Settings, disabled until Slack is connected). Message text comes from `src/lib/reminder-message.ts` (same builder as the Settings preview)
- **Done when:** the test button posts to #108state, and a skipped week posts nothing.
- Notes (as built; Slack-free — everything runs against a simulated Slack until the real app exists):
  - `src/lib/slack.ts` — `chat.postMessage` client (`SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, base URL from `SLACK_API_BASE`, default `https://slack.com/api`). Returns ok / not-configured / slack-error; never throws on Slack or network errors; the token is never logged and is redacted from errors.
  - `src/lib/reminder-blocks.ts` — Block Kit: mrkdwn section from `reminderMrkdwn` + *RSVP* (`APP_URL/`) and *Sponsor an item* (`APP_URL/schedule`) buttons; test posts get a "Test from Settings" context line and a `[Test]` text prefix.
  - `src/lib/reminder-decision.ts` — pure `decideReminder` (reminders off · no Thursday · skipped/cancelled · not Tuesday in New York · before `reminderTime` · already sent), unit-tested across EDT and EST. `src/lib/cron-auth.ts` — constant-time `CRON_SECRET` check that fails closed.
  - `src/lib/reminder.ts` + `src/app/api/cron/weekly-reminder/route.ts` — claim-then-post: `updateMany … where reminderSentAt is null` must return 1, and a Slack failure releases the claim (502) so the 15:00 UTC cron retries. Responses: 200 `{status:"sent"}` / `{status:"skipped",reason}` (incl. `slack-not-configured`), 401 wrong secret, 500 no `CRON_SECRET`, 502 Slack error.
  - `vercel.json` — the two Tuesday crons (`0 14 * * 2`, `0 15 * * 2`).
  - Settings → *Send test reminder* (`src/app/(app)/admin/settings/test-reminder-action.ts`): organizer-only; posts the current preview marked as a test, never sets `reminderSentAt`; shows "Test reminder sent to #108state" or the error. Still disabled with its hint while Slack isn't configured.
  - Testing "Tuesday 10:30 ET" on any day: the route accepts `?now=<ISO>` **only when `NODE_ENV === "development"`** (`next dev`; builds and Vercel deployments run as production, so it's ignored there), and still requires `CRON_SECRET`. e2e (`e2e/reminder.spec.ts`) uses the most recent Tuesday (never a future one, so syncing can't roll real weeks over) and a fake Slack (`e2e/fake-slack.ts`, a node:http server on `SLACK_API_BASE`'s port). Without `SLACK_*`/`CRON_SECRET` in `.env` those tests skip and the "button disabled" test runs instead.

## M8 — Polish & deploy
- ~~Settings page~~ (built early: `/admin/settings` — amount, RSVP deadline, reminders on/off, live Slack preview; reminder time + channel shown read-only); empty/loading/error states
- Desktop-first QA, then phone width: left nav → hamburger menu, kitchen cooking animation hidden
- Deploy to Vercel + Neon (`main` branch for production), set env vars, run migrations
  - As built: Prisma migrations baselined (`prisma/migrations/0_init`, marked applied on `dev` and `main`); Vercel runs `vercel-build` → `prisma migrate deploy` on **production builds only** (`scripts/migrate-if-production.mjs`), so preview builds never change a schema
  - `.vercelignore` keeps local `.env` files out of CLI deploys
  - Vercel env: `AUTH_SECRET` (Production + Preview), `CRON_SECRET` (Production) set; Slack keys, `ORGANIZER_SLACK_IDS` and `APP_URL` still to add
  - Preview deploy verified (Vercel Authentication protects previews)
- Test sign-in with a real workspace guest and a real Slack Connect user
- **Done when:** Chelsea runs a real Thursday on it.

## Backlog (post-MVP)
"Ordering is open" Slack post · Ready DMs · unpaid-sponsor DM reminder · "my usual" reorder · shopping list · stats · interactive Slack RSVP
