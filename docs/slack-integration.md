# Slack Integration

## Slack app setup
1. Create a Slack app at api.slack.com/apps in the Jahnel Group workspace.
2. **Bot scopes:** `chat:write`, `chat:write.public`, `users:read`, `users:read.email`.
3. **Sign in with Slack:** enable OpenID Connect (`openid`, `profile`, `email`) — used by Auth.js.
4. Install to workspace → copy the **Bot Token** (`SLACK_BOT_TOKEN`) and the **channel ID of #108state** (`SLACK_CHANNEL_ID`; open channel details → bottom of the About tab).
5. Invite the bot: `/invite @Breakfast Club` in #108state.

## Tuesday reminder (MVP)
- **When:** Tuesdays at **10:00am America/New_York**.
- **Trigger:** Vercel Cron → `GET /api/cron/weekly-reminder` with `Authorization: Bearer $CRON_SECRET`.
- Vercel cron is UTC, so run it hourly on Tuesdays (`0 * * * 2`) and have the route post only when NY time matches `AppSettings.reminderTime`.
- **Logic:**
  1. Find this week's Thursday BreakfastEvent.
  2. **Skip** if `remindersEnabled = false`, status is `SKIPPED` or `CANCELLED`, or `reminderSentAt` is set.
  3. Post to #108state, then set `reminderSentAt`.

### Message (Block Kit)
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
