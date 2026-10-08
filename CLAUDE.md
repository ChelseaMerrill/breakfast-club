# Breakfast Club — CLAUDE.md

A small internal web app for running a weekly **Thursday** office breakfast at Jahnel Group.
Chelsea (the **organizer**) posts each Thursday's **menu** and cooks breakfast. Coworkers
(**members**) **sponsor menu items** by putting their name next to an item — each sponsorship
means paying **$30 to Chelsea**, and Chelsea checks off who has paid. Members RSVP yes/no
(names and headcount visible to everyone) and, on weeks that need it, place their order the
morning of. The organizer **manually opens and closes ordering** and works from a live
**kitchen view** that tracks every order from placed → cooking → ready → picked up, including
**walk-ins** (unscheduled coworkers and visiting clients). A Slack bot posts a sign-up reminder
to **#108state** every Tuesday at 10am ET, unless that Thursday is skipped (e.g. a holiday).

## Read these first
| Doc | What it covers |
|---|---|
| `docs/PRD.md` | Goals, users, features, scope (MVP vs later) |
| `docs/domain-glossary.md` | Canonical terms — use these names in code |
| `docs/data-model.md` | Entities, fields, enums, relationships (Prisma-ready) |
| `docs/user-flows.md` | Step-by-step flows and screen list |
| `docs/slack-integration.md` | Bot setup, scheduled reminder, message formats |
| `docs/business-rules.md` | Ordering, sponsorship & payments, walk-ins, permissions, edge cases |
| `docs/build-plan.md` | Ordered milestones with acceptance criteria — build in this order |
| `docs/open-questions.md` | Decisions made + anything still open — ask before assuming |

## Key decisions (don't override without asking)
- Breakfast is every **Thursday**. A week can be **skipped** (holiday) — no reminder goes out.
- **The design wins.** `design/Breakfast Club.dc.html` is the source of truth for screens, routes, copy and behavior. If a doc and the design disagree, follow the design and fix the doc.
- **One menu item per Thursday** (e.g. Waffles), set by Chelsea inline on the Schedule page. There is no separate Menu page.
- **Sponsorship is per menu item.** Anyone can add their name (or a team, or two people) next to an item. Each sponsorship = **$30 paid to Chelsea**; she marks it **paid** in the app. The app tracks payment status only — it does not process payments.
- Each Thursday has a **sponsors needed** count (default 1). *Sponsor this* disappears once it's filled. Chelsea can also add a sponsor by typing the name of someone who isn't a member.
- The **kitchen view is visible to everyone** (read-only for members); only Chelsea moves orders along.
- **No automatic ordering window.** The organizer clicks *Open ordering* / *Close ordering*.
- Some weeks (e.g. bagels) have **ordering turned off** — RSVP only.
- **Walk-ins allowed**, including **guests** with no account (e.g. clients), added by name.
- **RSVP names and headcount are visible to everyone.**
- RSVP deadline: **Wednesday 5pm ET**. Reminder: **Tuesday 10–11am ET** (Vercel Hobby crons are daily and hour-precise).
- Only Chelsea is an organizer — no role toggle.
- **Sign-in is Slack only** (open-questions #42): **anyone in #108state**, re-checked every few hours; the organizer is Chelsea's Slack ID in `ORGANIZER_SLACK_IDS`. It turns on once the Slack app's `AUTH_SLACK_ID`/`AUTH_SLACK_SECRET` are set; until then a local-dev-only "Sign in as…" picker lists seed members.
- A Thursday finishes at **midnight NY** (ordering auto-closes then if Chelsea forgot).
- Full decision log: `docs/open-questions.md`.

## Design
- `design/Breakfast Club.dc.html` is the clickable prototype of every screen. Open it in a browser and use the MEMBER / ORGANIZER toggle to see both roles.
- Look: Fredoka (body) and Titan One (headings, uppercase) fonts; cream `#FFF4D6` background with `#F0D58C` dots; card `#FFFDF6`; dark-brown `#3B2314` text, 3px outlines and hard `4px 4px 0` shadows; red `#E8433F` accents; yellow `#FFC629` primary pill buttons; mint `#9BE3C4` secondary; cute SVG breakfast mascots scattered down the side margins (`src/components/mascots.tsx`, art generated from the prototype into `mascots-art.ts`; drawn client-side only, hidden on phones); animated cooking scenes on the kitchen view while ordering is open.
- Kitchen columns: Placed `#6C7BFF`, Cooking `#FF9F1C`, Ready `#3DBE7A`, Picked up `#808080`.
- Layout: a fixed left nav (232px) listing Home, Schedule, Place order, Kitchen view, and for the organizer Thursdays, Payments and Settings.
- `design/_ds/` is the Jahnel Group design system the prototype draws on.

## Tech stack
- **Next.js (App Router) + TypeScript**, Tailwind CSS, shadcn/ui
- **PostgreSQL on Neon** (via the Vercel Marketplace; branch `main` = live, `dev` = local + previews) via **Prisma 7** (`prisma.config.ts`, Neon driver adapter, client generated to `src/generated/prisma`)
- **Tests:** Vitest (unit, `src/**/*.test.ts`); Playwright (end-to-end, `e2e/`) — reuses `npm run dev` on :3000 (or starts it) against the Neon `dev` branch, signs in via the dev picker, and cleans up after itself. DB setup goes through `e2e/db-task.mts` (run with tsx; Playwright can't load the ESM Prisma client)
- **Auth:** Auth.js v5, JWT sessions, Sign in with Slack (OIDC) only
  - `src/auth.ts` — providers + callbacks (#108state gate, member upsert, 3-hour re-check, dev picker)
  - `src/lib/organizers.ts` — organizer rule (`ORGANIZER_SLACK_IDS`)
  - `src/proxy.ts` — Next 16 "proxy" (formerly middleware): redirects signed-out users, real 403 on `/admin/*`
  - `src/lib/dal.ts` — `getCurrentMember()` / `requireOrganizer()`; call from Server Components (inside `<Suspense>`) and at the top of every server action
- **Slack:** Slack app with a bot token (`chat:write`) posting to #108state
- **Scheduling:** Vercel Cron hitting a protected API route (`/api/cron/weekly-reminder`)
- **Realtime kitchen view:** polling every 5s for MVP
- **Hosting:** Vercel (Chelsea's personal Hobby account)
- **Workflow:** one branch + PR per milestone; Chelsea reviews and merges

Next.js 16 has breaking changes from older versions — see `AGENTS.md` and read `node_modules/next/dist/docs/` before writing Next.js code.

## Conventions
- Use the terms in `docs/domain-glossary.md` exactly.
- All times stored in UTC; display in `America/New_York`.
- Store money as integer cents (`3000` = $30.00).
- **Desktop-first UI**, matching the design. It must also work at phone width: the left nav collapses into a hamburger menu, and the kitchen view's cooking animation is hidden on phones.
- Server actions for mutations; validate all input with Zod.
- Role checks happen on the server, never only in the UI. The proxy is only an optimistic gate.
- Cache Components is on: anything reading the session, `searchParams` or the database goes behind `<Suspense>`; call `await connection()` before a DB read that isn't otherwise request-bound.
- Keep it simple: a ~20–50 person office tool, not a SaaS product.

## Environment variables
```
DATABASE_URL=
AUTH_SECRET=
AUTH_SLACK_ID=           # Slack sign-in turns on once these two are set
AUTH_SLACK_SECRET=
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=        # channel ID for #108state
ORGANIZER_SLACK_IDS=     # Chelsea's Slack user ID
CRON_SECRET=             # Vercel Cron bearer secret; the reminder route refuses everything without it
SLACK_API_BASE=          # optional; default https://slack.com/api (local dev/e2e: the fake Slack, e.g. http://127.0.0.1:3901/api)
APP_URL=
```
**Schema changes:** edit `prisma/schema.prisma`, run `npm run db:migrate -- --name <change>`, commit the migration. Production applies it on deploy; previews never migrate.

**Local env files:** `.env` holds local dev settings (Neon `dev` branch). Next.js loads `.env.local` *over* `.env`, and `vercel env pull` writes `.env.local` with the **live** database — so never pull into `.env.local`. Use `vercel env pull .env.vercel` (git-ignored, not loaded by Next).

## Commands
```
npm run dev          # local dev (http://localhost:3000)
npm run build        # prisma generate + next build
npm run lint         # eslint
npm run typecheck    # next typegen + tsc
npm test             # vitest (unit)
npm run test:e2e     # playwright (end-to-end; needs .env with the dev database)
npm run format       # prettier --write
npm run db:migrate   # schema change: create + apply a migration on the dev branch (direct URL)
npm run db:migrate:deploy  # apply pending migrations (production builds do this automatically)
npm run db:push      # prototyping only — prefer migrations now that main is live
npm run db:seed      # dev-only sample data (needs ALLOW_SEED=true)
npm run db:studio    # browse the database
```
