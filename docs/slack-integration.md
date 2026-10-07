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
- **Logic:**
  1. Top up Thursdays to 8 weeks ahead; find this week's Thursday BreakfastEvent.
  2. **Skip** if `remindersEnabled = false`, status is `SKIPPED` or `CANCELLED`, NY time is before `reminderTime`, or `reminderSentAt` is set.
  3. Post to #108state, then set `reminderSentAt`.

### Message (Block Kit)
Built by `src/lib/reminder-message.ts` (`buildReminder` + `reminderMrkdwn`), which also drives the Settings preview.
```
*Breakfast Club — Thursday, Oct 8*
On the menu:
• Waffles — _sponsored by Corbin_
Headcount so far: *6*
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

## Next-phase messages
| When | Where | Message |
|---|---|---|
| Chelsea taps Open ordering (checkbox "Post to #108state") | Channel | "Ordering is open! Place your order →" |
| Order marked READY | DM to member | "Your breakfast is ready :fried_egg:" |
| Sponsorship unpaid 3+ days after the Thursday | DM to sponsor(s) | "Friendly reminder: $30 for Pancakes (Oct 15) to Chelsea" |

## Later: interactive RSVP
Add Interactivity (`/api/slack/interactions`) so the reminder's buttons write the Rsvp directly. Verify the Slack signing secret.
