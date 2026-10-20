# Environments

Changes reach production in three steps:

```
your laptop ──push──▶ feature branch ──PR──▶ staging ──test──▶ PR ──▶ main (production)
```

| | Local dev | Staging | Production |
|---|---|---|---|
| Runs | `npm run dev` on your laptop | Vercel preview of the `staging` git branch | Vercel production (`main`) |
| Address | http://localhost:3000 | the branch's fixed preview URL, `https://<project>-git-staging-<scope>.vercel.app` | https://breakfast-club-nine.vercel.app |
| Database | Neon `dev` | Neon `dev` (shared with local) | Neon `main` (live) |
| Sign-in | "Sign in as…" picker (seed members) | Sign in with Slack | Sign in with Slack |
| Who can sign in | anyone on your laptop | members of **#breakfast-club-test** | members of **#108state** |
| Slack posts | none, or the fake Slack (`SLACK_API_BASE`) | **#breakfast-club-test** | **#108state** |
| Crons | `?now=` by hand | `npm run staging:cron` by hand | Vercel Cron |
| Migrations | `npm run db:migrate` | applied on deploy | applied on deploy |

## Workflow
1. Branch off `staging`, work locally, push, and open a PR **into `staging`**.
2. Merge it. Vercel deploys staging in a minute or two; try the change there.
3. When staging looks right, open a PR from **`staging` into `main`**. Merging it deploys production.
4. A hotfix can go straight to `main`. Afterwards, merge `main` back into `staging` so they don't drift.

## Safety rails (in the code)
- **Staging can't post to #108state.** Outside production, before posting to the channel, the app asks Slack for the channel's name. If it's `108state`, or Slack can't say, nothing is posted (`src/lib/slack.ts`). Direct messages (order ready, payment reminders) still go out, to whoever is on the dev database with a real Slack ID.
- **Only production and staging migrate on deploy.** Other preview branches never change a schema (`scripts/migrate-on-deploy.mjs`).
- **The cron clock override (`?now=`)** works locally and on preview deploys, never in production (`src/lib/reminder-decision.ts`).

## One-time setup

### Slack (api.slack.com/apps → the Breakfast Club app)
1. Create a **public** channel **#breakfast-club-test**. It must be public: the bot only has `channels:read`. Invite the bot (`/invite @Breakfast Club`) and anyone who should test.
2. Copy its channel ID (channel details → bottom of the About tab).
3. **OAuth & Permissions → Redirect URLs:** add `https://<staging URL>/api/auth/callback/slack`. Keep the production URL.

### Vercel (project → Settings → Environment Variables)
For each variable: choose **Preview** only, then **Select a custom Preview branch → `staging`**. A branch-specific value overrides the general Preview value.

| Variable | Value for staging |
|---|---|
| `DATABASE_URL` | Neon **`dev`** pooled URL (same as local `.env`) |
| `DATABASE_URL_UNPOOLED` | Neon **`dev`** direct URL (migrations use it) |
| `AUTH_SECRET` | a new secret (see below), not production's |
| `AUTH_SLACK_ID`, `AUTH_SLACK_SECRET` | same as production (same Slack app) |
| `SLACK_BOT_TOKEN` | same as production |
| `SLACK_CHANNEL_ID` | **#breakfast-club-test**'s ID, never #108state's |
| `ORGANIZER_SLACK_IDS` | Chelsea's Slack ID (same as production) |
| `CRON_SECRET` | a new secret (see below), not production's |
| `APP_URL` | the staging URL |

Make each new secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Don't use `npx auth secret`: it writes `.env.local`, which Next.js loads over `.env`.

> **Double-check both database URLs point at `dev`.** Staging runs migrations on deploy, so a live `DATABASE_URL_UNPOOLED` would migrate the live database.

Then:
1. **Settings → Deployment Protection → Protection Bypass for Automation:** generate a secret. This lets `npm run staging:cron` through Vercel Authentication.
2. Redeploy staging (Deployments → latest `staging` deploy → Redeploy) so it picks up the variables.
3. **Check it:** the build log says `[migrate] staging build`. Signing in shows the dev data (seed members such as "Jordan Reyes"), not the live data.

Staging stays behind **Vercel Authentication**, so you need your Vercel login to open it. For coworkers to test, turn Vercel Authentication off for previews (Settings → Deployment Protection). Sign-in still requires #breakfast-club-test.

### Your laptop
Create `.env.staging` (git-ignored) for the cron script:
```
STAGING_URL=https://<staging URL>
STAGING_CRON_SECRET=<staging CRON_SECRET>
STAGING_BYPASS_SECRET=<Protection Bypass for Automation secret>
```

## Testing on staging
- **Tuesday reminder:** `npm run staging:cron -- weekly-reminder --now 2026-10-20T14:30:00Z` (any Tuesday at or after the reminder time, in UTC). It posts once per Thursday. To send it again, clear `reminderSentAt` on that Thursday in the dev database (`npm run db:studio`).
- **Wednesday payment DMs:** `npm run staging:cron -- payment-reminder --now 2026-10-21T15:30:00Z`. Also once per Thursday (`paymentReminderSentAt`).
- **Settings → Send test reminder** and **Open ordering → Post** go to #breakfast-club-test.
