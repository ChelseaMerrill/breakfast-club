# Build Plan

Build in this order. Each milestone should be working end-to-end before starting the next.
Paste one milestone at a time into Claude Code: *"Implement Milestone N from docs/build-plan.md."*

## M0 — Scaffold
- Next.js + TS + Tailwind + shadcn/ui, Prisma + Neon Postgres (Neon `dev` branch locally), ESLint/Prettier, Vitest
- Schema from `docs/data-model.md`; dev-only seed script with 4 upcoming Thursdays and the design's sample menu
- **Done when:** `npm run dev` shows a placeholder home page and `db:seed` fills the dev database.

## M1 — Auth & roles
- Sign in with **Google** via Auth.js (interim, open-questions #41): verified `jahnelgroup.com` accounts only; create/update the Member by email on login
- `ORGANIZER_EMAILS` grants ORGANIZER (cmerrill@jahnelgroup.com); no role toggle
- Slack sign-in + #108state gate (`conversations.members`, re-checked every few hours) built but **off** until the Slack app exists (`AUTH_SLACK_ID`/`AUTH_SLACK_SECRET`; then `ORGANIZER_SLACK_IDS`)
- Local-dev-only "Sign in as…" picker of seed members
- Server-side role guard for `/admin/*`
- **Done when:** a jahnelgroup.com Google account can sign in, any other Google account can't, cmerrill@jahnelgroup.com gets the organizer pages, and non-organizers get 403 on admin routes. (Slack: same checks for #108state once enabled.)

## M2 — Schedule & skip weeks
- `/schedule` list of Thursdays
- `/admin/events` (*Thursdays*): top up to 8 Thursdays ahead on load, *Add next Thursday*, Skip (with reason) / Restore, toggle *Ordering enabled*
- Midnight-NY rollover: events become `COMPLETED`; forgotten-open ordering auto-closes with a note (runs on page load — `syncThursdays()` in `src/lib/events.ts`)
- App shell: the design's left nav (hamburger on phones)
- Playwright end-to-end tests start here (pulled forward from M3)
- **Done when:** Chelsea skips a Thursday and it shows faded on the Schedule as "No breakfast: <reason>".

## M3 — RSVP & headcount
- Home card with Yes/No; names of who's in/out and headcount visible to everyone
- RSVP deadline (Wednesday 5pm ET) enforced — buttons disabled with "RSVPs closed Wed 5pm"; organizer can edit anytime
- End-to-end test covers RSVP
- Implementation: rules in `src/lib/rsvp.ts` (deadline from settings, DST-safe; organizer exempt; headcount = Yes + walk-ins/guests); Home card `src/components/home/this-thursday-card.tsx`; action `src/app/(app)/rsvp-actions.ts`
- Skipped/cancelled Thursday on Home: banner + next breakfast date instead of RSVP buttons
- **Done when:** two members RSVP and both see each other's names and the count; edits are blocked after the deadline.

## M4 — Menu & sponsorship
- On `/schedule`, the organizer types each Thursday's **menu item**, sets **sponsors needed** (−/+), and can **add a sponsor by name**
- Any member: *Sponsor this* (hidden once filled) → Just me / Me + someone / A team → "You're on the menu. Please pay $30 to Chelsea."; remove own unpaid sponsorship from Home
- Home *Menu* card shows the item and "Sponsored by …" / "Needs N sponsor(s) ($30 each)"
- **Done when:** Chelsea sets a menu item and a member's name (or team) appears next to it.
- Built (notes):
  - Rules are pure functions in `src/lib/sponsorship-rules.ts` (unit-tested); actions in `src/app/(app)/schedule/actions.ts` lock the Thursday's row (`SELECT … FOR UPDATE`) before counting sponsorships, so two people can't take the last spot.
  - Menu item box saves on Enter/blur; emptying it removes the item only if it has no sponsors or orders. Renaming keeps sponsorships (they point at the item).
  - Sponsors needed: 1–10, and − stops at the number of sponsorships already on the item.
  - The organizer's *Add sponsor by name* respects the cap too ("Already fully sponsored. Press + …"). She removes any sponsor with the × on its chip on the Schedule (Payments, M5, will also list them).
  - *A team* stores `teamName` **and** links the member who signed it up, so it shows in their *My sponsorships* and they can remove it.
  - A member can't be on two sponsorships of the same item ("You're already sponsoring …").
  - Organizer controls are hidden on skipped/cancelled Thursdays (the design shows them on every card; there's nothing to sponsor on a skipped week).
  - Home: `src/components/home/menu-card.tsx` (first Thursday from today) and `my-sponsorships-card.tsx` (upcoming sponsorships plus past unpaid ones, each with its Thursday's date).

## M5 — Payments
- `/admin/payments`: all sponsorships with Paid checkbox, filters (unpaid / this week / all), totals collected and outstanding
- Members see *$30 due* / *Paid ✓* on their own sponsorships
- **Done when:** Chelsea checks off a sponsorship and the sponsor sees *Paid ✓*.

## M6 — Ordering & kitchen view
- Organizer **Open ordering / Close ordering** (no timers); reopen allowed
- `/order/[eventId]`: order builder from orderable items; walk-in if no Yes RSVP
- `/kitchen/[id]`: Placed / Cooking / Ready / Picked up columns; everyone can watch, only the organizer can tap to advance / *← Back* / *Cancel*; animated cooking scene while ordering is open
- **+ Walk-in**: name box suggests members as you type; anything else becomes a guest
- Member home shows live order status (5s polling)
- **Done when:** Chelsea opens ordering, takes member + guest orders, runs them to Picked up, and closes ordering. Ordering-off Thursdays show no ordering UI.

## M7 — Slack Tuesday reminder
- `/api/cron/weekly-reminder` with CRON_SECRET, two Tuesday crons (14:00 + 15:00 UTC), at-or-after-10am NY check, `reminderSentAt` guard
- Message lists menu items with sponsors and items still needing one
- Skips SKIPPED/CANCELLED Thursdays and when reminders are off
- `vercel.json` cron config; *Send test reminder* button and live Slack preview in settings
- **Done when:** the test button posts to #108state, and a skipped week posts nothing.

## M8 — Polish & deploy
- Settings page; empty/loading/error states
- Desktop-first QA, then phone width: left nav → hamburger menu, kitchen cooking animation hidden
- Deploy to Vercel + Neon (`main` branch for production), set env vars, run migrations
- Test sign-in with a real workspace guest and a real Slack Connect user
- **Done when:** Chelsea runs a real Thursday on it.

## Backlog (post-MVP)
"Ordering is open" Slack post · Ready DMs · unpaid-sponsor DM reminder · "my usual" reorder · shopping list · stats · interactive Slack RSVP
