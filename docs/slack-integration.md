# Slack Integration

## Slack app setup
1. Create a Slack app at api.slack.com/apps in the Jahnel Group workspace.
2. **Bot scopes:** `chat:write`, `chat:write.public`, `users:read`, `users:read.email`, `channels:read` (to check #108state membership — it's a public channel).
3. **Sign in with Slack:** enable OpenID Connect (`openid`, `profile`, `email`) — used by Auth.js. Redirect URL: `APP_URL/api/auth/callback/slack` (HTTPS).
4. **Manage Distribution → Activate Public Distribution** (unlisted, not in the Slack Marketplace) so Slack Connect members of #108state from other orgs can sign in, if their org allows it. Workspace guests are likely blocked by Slack regardless — they get entered by name.
5. Install to workspace → copy the **Bot Token** (`SLACK_BOT_TOKEN`) and the **channel ID of #108state** (`SLACK_CHANNEL_ID`; open channel details → bottom of the About tab).
6. Invite the bot: `/invite @Breakfast Club` in #108state.

## Channel-membership gate
- On sign-in, page through `conversations.members` for `SLACK_CHANNEL_ID` (cursor, `limit` 200; Tier 4) and allow the user only if their Slack user ID is in it. Cache the member set for a few minutes.
- Re-check every few hours during a session; sign the user out if they've left.
- Slack Connect external users appear in `conversations.members`; verify their OIDC `https://slack.com/user_id` matches (fall back to email if not).

## Tuesday reminder (MVP)
- **When:** Tuesdays, **10:00–10:59am America/New_York**. Vercel Hobby crons run at most once a day, in UTC, anywhere within the scheduled hour.
- **Trigger:** two Vercel Crons → `GET /api/cron/weekly-reminder` with `Authorization: Bearer $CRON_SECRET`:
  - `0 14 * * 2` (10am EDT) and `0 15 * * 2` (10am EST). The route posts only when NY time is at or after `AppSettings.reminderTime`, so DST is handled.
- **Logic** (as built: `src/lib/reminder.ts`, decision in `src/lib/reminder-decision.ts`):
  1. Check `Authorization: Bearer $CRON_SECRET` (constant-time; **401** if wrong, **500** if `CRON_SECRET` isn't set — fail closed).
  2. Top up Thursdays to 8 weeks ahead; find this week's Thursday (first BreakfastEvent from today, New York).
  3. **Skip** (200, `{status:"skipped", reason}`) if `remindersEnabled = false`, there's no Thursday, its status is `SKIPPED` or `CANCELLED`, it isn't `reminderWeekday` (Tuesday) in New York, NY time is before `reminderTime`, `reminderSentAt` is set, or Slack isn't configured (`slack-not-configured` — not an error).
  4. **Claim** the Thursday: `updateMany where reminderSentAt is null` → set it; only the caller that gets count 1 posts, so the two crons can't both post.
  5. Post to #108state. If Slack fails, **release** the claim (`reminderSentAt` back to null) and return **502** `{status:"error"}` so the second cron retries. Success → 200 `{status:"sent"}`.
- **Local dev / tests:** `?now=<ISO>` overrides the clock **only under `next dev`** (`NODE_ENV === "development"`); production ignores it.

### Slack client
`src/lib/slack.ts` posts `chat.postMessage` with `SLACK_BOT_TOKEN` to `SLACK_CHANNEL_ID`. `SLACK_API_BASE` (default `https://slack.com/api`) lets local dev and e2e point it at a fake Slack (`e2e/fake-slack.ts`). It returns ok / not-configured / slack-error and never throws, logs or returns the token.

### Send test reminder (Settings)
Organizer-only. Posts the current Settings preview with a "Test from Settings" context line (text prefixed `[Test]`). Does **not** set `reminderSentAt`. Disabled with "Available once Slack is connected" until `SLACK_BOT_TOKEN` and `SLACK_CHANNEL_ID` are set.

### Message (Block Kit)
Text built by `src/lib/reminder-message.ts` (`buildReminder` + `reminderMrkdwn`), which also drives the Settings preview; Block Kit by `src/lib/reminder-blocks.ts` (a mrkdwn section + an actions block with two URL buttons; `text` fallback = the same mrkdwn).
```
*Breakfast Club — Thursday, Oct 8*
On the menu:
• Waffles — _sponsored by Corbin_
RSVP by *Wednesday 5pm*.
[ RSVP ]  [ Sponsor an item ]   (buttons → APP_URL/ and APP_URL/schedule)
```
Sponsor text per item (matches the Settings preview in the design):
- fully sponsored: `sponsored by Corbin` (names joined with ", ")
- partly sponsored: `sponsored by Fred De Koker (needs 1 more)`
- no sponsors yet: `needs 2 sponsor(s) ($30 each)`
- If ordering is off for the week, add: "_No orders needed this week — just RSVP!_"
- If the menu isn't posted yet: "_Menu coming soon!_"
- Payment status is **never** posted in the channel.

## "Your order is ready" DM (built — open-questions #50)
- **When:** the organizer moves an order **Cooking → Ready** on the kitchen queue.
- **To:** the member who placed it, via `chat.postMessage` with their Slack user ID as `channel` (bot DM; `chat:write` only). Guests and `SEED_` members are skipped.
- **Message:** ":fried_egg: *Your breakfast is ready!* Waffles (Blueberry) — come grab it from the kitchen." + a **View the kitchen queue** button (`APP_URL/kitchen/<id>`).
- Sent with Next's `after()` so the kitchen tap never waits on Slack; best effort (errors are logged, never shown to the organizer).
- In the Slack app, enable **App Home → Messages Tab** (read-only is fine) so the DM shows up.
- Code: `src/lib/ready-dm.ts` (pure), `src/lib/ready-notify.ts`, `postDirectMessage` in `src/lib/slack.ts`.

## Next-phase messages
| When | Where | Message |
|---|---|---|
| Chelsea taps Open ordering (checkbox "Post to #108state") | Channel | "Ordering is open! Place your order →" |
| Sponsorship unpaid 3+ days after the Thursday | DM to sponsor(s) | "Friendly reminder: $30 for Pancakes (Oct 15) to Chelsea" |

## Later: interactive RSVP
Add Interactivity (`/api/slack/interactions`) so the reminder's buttons write the Rsvp directly. Verify the Slack signing secret.
