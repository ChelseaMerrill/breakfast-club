# Product Requirements — Breakfast Club

## Problem
Weekly Thursday office breakfast is coordinated by hand: posting the menu, finding sponsors
for each item and chasing their $30, figuring out who's eating, and keeping track of orders
(including unexpected guests) while cooking.

## Goals
1. Publish each Thursday's **menu** and let coworkers **sponsor items** by adding their name.
2. Track which sponsors have **paid their $30** to Chelsea.
3. Know **who's coming** and the **headcount** before shopping — visible to everyone.
4. Collect **orders the morning of** when the menu needs it — opened and closed by hand.
5. Give the organizer a **kitchen queue** to track each order, including walk-ins and guests.
6. **Automatically remind** #108state every Tuesday to sign up (skipping holiday weeks).

## Non-goals (for now)
- Processing payments (Venmo, card, etc.) — the app only records *paid / not paid*
- Grocery list generation (see Later)
- Multiple organizers

## Users & roles
| Role | Who | Can do |
|---|---|---|
| **Organizer** (admin) | Chelsea | Everything: Thursdays, menu items, sponsorships, mark paid, open/close ordering, advance orders on the kitchen queue, walk-ins, settings |
| **Member** | Any coworker in #108state who signs in with Slack | Sponsor menu items, RSVP, see who's coming, place/edit own order, see own order status, watch the kitchen queue (read-only) |
| **Guest** | Clients or visitors with no account | Nothing in the app — the organizer adds their order by name |

## Features

### MVP
1. **Sign in with Slack** — members of #108state only. Auto-creates a member profile (name, avatar, Slack ID).
2. **Weekly schedule** — upcoming Thursdays with their menu item, sponsors, status and headcount. On the **Thursdays** admin page the organizer can **skip** a Thursday (holiday) or **restore** it, and toggle *Ordering enabled*.
3. **Menu item per Thursday** — each Thursday has **one menu item** (e.g. Waffles). Chelsea types it inline on the Schedule page and sets how many **sponsors are needed** (default 1). There is no separate Menu page.
4. **Sponsor a menu item** — any member clicks *Sponsor this* and confirms; their name goes next to the item. The organizer can also type in a name. **Each sponsor gives Chelsea $30** (two sponsors = $30 each), by cash or Venmo @Chelsea-Merrill-1. *Sponsor this* disappears once the sponsors-needed count is filled.
5. **Payment tracking** — Chelsea sees every sponsorship with a **Paid** checkbox; members see their own "Paid ✓ / $30 due" status. Unpaid list across weeks.
6. **RSVP** — *Yes / No* per Thursday. **Everyone sees the names** of who's in and out, plus the headcount (Yes + walk-ins).
7. **Ordering on/off per week** — *ordering on* (people order the morning of) or *ordering off* (e.g. bagels — RSVP only).
8. **Manual ordering control** — Chelsea taps **Open ordering** and **Close ordering**. No automatic times.
9. **Ordering** — while open, members order from that Thursday's menu. No RSVP needed (walk-in).
10. **Walk-ins & guests** — Chelsea can add an order for any member or for a guest by name (e.g. "Client — Acme").
11. **Kitchen queue** — tablet-friendly board: *Placed → Cooking → Ready → Picked up*. Everyone can watch it; only the organizer can tap a card to advance it, step it back, or cancel it. Shows an animated cooking scene while ordering is open (hidden on phones).
12. **Order status for members** — live status on their home screen.
13. **Tuesday Slack reminder** — 10am ET to #108state: Thursday date, the menu item with its sponsors (or how many more it needs), the RSVP deadline, and *RSVP* / *Sponsor an item* buttons. Not sent if that Thursday is skipped.

### Next
- ~~Slack post when ordering opens~~ — built: Chelsea writes the message each week (open-questions #55)
- Slack DM reminder to sponsors who haven't paid
- ~~"My usual" one-tap reorder~~ — not planned (open-questions #54)
- ~~Cancel a Thursday~~ — not needed; Skip covers it (open-questions #44)
- Organizer event-detail page (Yes / No / no-response lists) — not in the design
- ~~More than one menu item per Thursday / an item-options editor~~ — not needed; one item per Thursday, and the order form's **Customize** box covers choices like egg style (open-questions #45)
- "Copy last week's menu"

### Later
- ~~Shopping list~~ — not planned (open-questions #54)
- Stats: attendance trends, popular items, sponsor totals
- Interactive Slack buttons to RSVP without opening the app

## Success measures
- Chelsea stops tracking RSVPs, menus, sponsors, payments, or orders anywhere else
- Headcount known by Wednesday 5pm
- Every sponsorship marked paid within a week
- No lost or mixed-up orders, including for guests
