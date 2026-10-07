# Open Questions & Decisions

## Decided
| # | Question | Decision |
|---|---|---|
| 1 | Breakfast weekday | **Thursday**. Reminder every Tuesday unless that Thursday is skipped (holiday). |
| 2 | RSVP deadline | **Wednesday 5:00pm ET** |
| 3 | Ordering window | **No automatic window.** Chelsea opens and closes ordering by hand. Some Thursdays (e.g. bagels) have ordering off. |
| 4 | Reminder time | **Tuesday 10:00am ET** |
| 5 | Slack channel | **#108state** |
| 6 | Walk-ins | **Yes**, including unscheduled coworkers and guests such as clients. |
| 7 | Sponsor shape | **A team, or one or two people.** |
| 8 | Headcount visibility | **Visible to everyone.** |
| 9 | Menu | ~~A Menu tab~~ → superseded by #20: Chelsea sets each Thursday's menu item on the Schedule; people sponsor it by adding their names. |
| 10 | Organizers | **Just Chelsea.** |
| 11 | Hosting/DB | **Vercel + Neon.** |
| 12 | Meaning of a name next to a menu item | **They pay $30 to Chelsea.** Chelsea checks off when paid. |
| 13 | Who can add names to menu items | **Anyone.** |
| 14 | RSVP visibility | **Names and numbers visible to everyone.** |
| 15 | Source of truth when docs and design disagree | **The design** (`design/Breakfast Club.dc.html`). |
| 16 | Sponsorship is per menu item | **Yes** — no "sponsor the whole week". (design) |
| 17 | Two people or a team on one sponsorship | **One $30 total.** Modal: "One sponsorship is $30 paid to Chelsea, even when two people share it." (design) |
| 18 | More than one sponsorship per item | **Yes, up to the Thursday's sponsors-needed count** (default 1). (design) |
| 19 | Payment status visibility | **Chelsea + the sponsor only; never in Slack.** (design) |
| 20 | Menu items per Thursday | **One**, edited inline on the Schedule; no Menu page. (design) |
| 21 | Kitchen view visibility | **Everyone can watch; only Chelsea moves orders.** Route `/kitchen/[id]`. (design) |
| 22 | Cancel a Thursday | **Not in the design** — Skip/Restore only for MVP. |
| 23 | Item options (e.g. egg style) | **Seed/DB-only for MVP.** The order form shows them; there's no editor screen. |
| 24 | Screen sizes | **Desktop-first**, matching the design. Responsive down to phone width: the left nav becomes a **hamburger menu**, and the kitchen view's **cooking animation is hidden** on phones. |

### Decided 2026-10-07 (grilling session)
| # | Question | Decision |
|---|---|---|
| 25 | Hosting account | **Chelsea's personal Vercel (Hobby) account.** Hobby is "non-commercial, personal use only" — revisit if that becomes a problem. |
| 26 | Database | **Neon via the Vercel Marketplace.** Neon branch `main` = live app; branch `dev` = local `.env` and preview deploys. |
| 27 | Seed data | **Dev only.** `db:seed` refuses to run unless `ALLOW_SEED=true` and never in production. Live members come only from Slack sign-in; the organizer comes from `ORGANIZER_SLACK_IDS`. |
| 28 | Who can sign in | **Anyone who is a member of #108state** (public channel). Checked with `conversations.members` (scope `channels:read`) at sign-in and re-checked every few hours; leavers are signed out, their history stays. |
| 29 | Guests & Slack Connect users | Slack app has **public distribution on** (unlisted) so external users can sign in if their org allows it. Workspace guests are likely blocked by Slack itself. Anyone who can't sign in is **entered by name** by Chelsea. Test with a real guest and a real external account. |
| 30 | Slack app | Chelsea creates it now and requests admin approval in parallel. |
| 31 | Organizer access | **Only Chelsea's account.** No role toggle; one nav = member pages + Thursdays, Payments, Settings. |
| 32 | Signing in during development | A **"Sign in as…" picker** of seed members, **local dev only** (never in production). Seed Chelsea is the only organizer in it. |
| 33 | When a Thursday is done | Ordering weeks: when **Chelsea closes ordering** (she can reopen that day). Home keeps showing that Thursday until **midnight NY**, then moves on and the event becomes `COMPLETED`. Ordering-off weeks complete automatically at midnight NY. |
| 34 | Forgotten close | "Still open" warning on Thursday afternoon, then **auto-close at midnight NY** with a "closed automatically" note. |
| 35 | Creating Thursdays | Topped up to **8 weeks ahead** whenever Schedule/Thursdays loads or the reminder cron runs. Chelsea can go further with **Add next Thursday** (Thursdays only). |
| 36 | Reminder timing (Hobby cron is daily, ±59 min) | **Two Tuesday crons, 14:00 and 15:00 UTC**; the first run at/after 10:00 NY posts (`reminderSentAt` guard). Lands **10:00–10:59 ET**; Settings shows "Tuesday, 10–11am ET". |
| 37 | Walk-in name box | **Suggests members as you type**; a name not picked becomes a guest. |
| 38 | RSVP after the deadline | Buttons **shown disabled** with "RSVPs closed Wed 5pm". |
| 39 | Tests | **Vitest** for rules and logic from M0; **Playwright** end-to-end from M3. |
| 40 | Workflow | **One branch + PR per milestone**, reviewed and merged by Chelsea. |

### Decided 2026-10-07 (later)
| # | Question | Decision |
|---|---|---|
| 41 | Sign-in while the Slack app can't be created | **Google SSO for now.** Only verified Google accounts on `ALLOWED_EMAIL_DOMAINS` (default `jahnelgroup.com`) can sign in; members are matched by email. **cmerrill@jahnelgroup.com** is the organizer (`ORGANIZER_EMAILS`); everyone else is a member. The #108state gate (#28) and Slack sign-in stay in the code, off until `AUTH_SLACK_ID`/`AUTH_SLACK_SECRET` are set. Supersedes #28/#29 until then. |
