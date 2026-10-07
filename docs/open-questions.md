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
