# Business Rules

## BreakfastEvents
- One BreakfastEvent per Thursday. The app tops up to **8 weeks ahead** whenever Schedule or Thursdays loads, or the reminder cron runs. The organizer can add more with **Add next Thursday** (always the next Thursday after the last one).
- Status flow: `SCHEDULED → ORDERING_OPEN ⇄ ORDERING_CLOSED → COMPLETED`.
  - **Close ordering** ends the morning; the organizer can **reopen** the same day.
  - At **midnight NY** after the Thursday the event becomes `COMPLETED` and Home moves to the next Thursday. Until then Home keeps showing it (so members can follow orders still cooking).
  - If ordering is still open at midnight it is **closed automatically** and the organizer sees a "closed automatically" note. A "still open" warning shows on admin pages from Thursday afternoon.
  - Ordering-off Thursdays go `SCHEDULED → COMPLETED` at midnight NY.
  - Organizer can mark any future Thursday `SKIPPED` (holiday, with optional reason, default "Holiday") and **Restore** it. `CANCELLED` stays in the schema but has no UI in the design (see PRD → Next).
  - Skipped Thursdays get **no Tuesday reminder**, appear faded on the Schedule as "No breakfast: <reason>", and show no RSVP or *Sponsor this* buttons.
- `orderingEnabled = false` (e.g. bagels): RSVP only; no Open ordering button.

## Menu
- Each Thursday has **one menu item** (e.g. Waffles). Only the organizer sets it, inline on the Schedule page. Renaming it also renames it on that Thursday's sponsorships.
- Each Thursday has a **sponsors needed** count (default 1, minimum 1, maximum 10), set by the organizer with −/+ on the Schedule page. It can't go below the number of sponsorships already on the item.
- Emptying the menu item box removes the item, unless it has sponsorships or orders (then rename it instead).
- Editing a menu after orders exist does not change placed orders (OrderLine keeps a name snapshot). An item with orders or sponsorships can't be deleted — hide it instead.

## Sponsorship & payments
- **Anyone** signed in can sponsor the menu item on an upcoming (not skipped) Thursday **while it still needs sponsors**. Once sponsorships reach the sponsors-needed count, *Sponsor this* is hidden.
- A Sponsorship is **one person (Just me), two people (Me + someone), or a team name (A team)**.
- A member can be on only one Sponsorship per menu item.
- The organizer can also add a Sponsorship by typing any name (for someone who isn't a member). This also respects sponsors needed; she presses + first to add more.
- Each Sponsorship owes the **sponsorship amount ($30)** to Chelsea — one payment per sponsorship, even if two people share it.
- An item can have more than one Sponsorship, up to its sponsors-needed count (each owes $30).
- A member can remove a sponsorship they're on until it's marked **Paid** or the Thursday has passed; after that only the organizer can change it.
- **Only the organizer** marks a sponsorship Paid / unpaid. `paidAt` is recorded when marked Paid and cleared when unchecked.
- On Payments, *Collected* and *Outstanding* total every sponsorship (each its own `amountCents`), whatever filter is selected. *This week* means the Thursday Home shows (the first one from today, New York time).
- Payment status is visible to the organizer and to the sponsor(s) on it; it is never shown publicly or posted in Slack.
- If a Thursday is skipped/cancelled after sponsorships exist, they stay listed for the organizer to remove or refund outside the app.

## Ordering (manual)
- **No automatic ordering times.** Ordering is open only between the organizer tapping **Open ordering** and **Close ordering**; reopening is allowed.
- Members can edit or cancel their own order while it's `PLACED` and ordering is open.
- Status changes are organizer-only: tap a card to go `PLACED → COOKING → READY → PICKED_UP`; *← Back* steps back one; *Cancel* (on Placed cards) cancels.
- The organizer can **Delete** an order once it's **Picked up** (asks to confirm; can't be undone). It drops out of the headcount if it was a walk-in or guest, and a member whose order is deleted can order again while ordering is open (open-questions #46).
- Members can edit their order until it moves to Cooking.
- Only items with `orderable = true` appear in the order form.
- Ordering can only be opened for **this Thursday** (the one Home shows), and never on ordering-off weeks.
- The kitchen shows a **"To make"** item total for orders not yet picked up. Order **notes** (may include allergies) are shown to the organizer only; members watching the board see names and items.
- Order moves are guarded on the status the organizer saw, so a double tap can't skip a column. Moves still work after ordering closes, until the Thursday completes at midnight.
- The "still open" warning (decision #34) shows on the kitchen from **2pm New York time** on the day.

## Walk-ins & guests
- **Walk-ins are always allowed.** A member without a Yes RSVP can still order while ordering is open (`isWalkIn`).
- The organizer can add an order for any member or for a **guest** by name (e.g. "Client – Acme"). The name box **suggests members as you type**; a name not picked from the suggestions becomes a guest.
- Guests can have multiple orders per event; members have one.
- Walk-ins count toward the headcount.

## RSVP & headcount
- One Rsvp per member per Thursday; changing overwrites.
- Members can change their RSVP until **Wednesday 5pm ET**; after that the buttons show **disabled** with "RSVPs closed Wed 5pm". The organizer can change her own RSVP anytime, but not other people's (open-questions #43).

## Sign-in & access
- **Sign in with Slack only** (open-questions #42): **anyone in #108state** can sign in. Membership is checked at sign-in and re-checked every few hours; someone who has left the channel is signed out (their history stays).
- People who can't sign in (clients, guests) are entered **by name** by the organizer.
- **Only Chelsea** (her Slack user ID in `ORGANIZER_SLACK_IDS`) is an organizer. There is no role toggle: her nav shows the member pages plus Thursdays, Payments and Settings.
- In **local development only**, a "Sign in as…" picker lists seed members. It must be impossible to enable in production.
- **Everyone can see** who RSVP'd Yes and No, and the headcount (= Yes + walk-ins).

## Permissions
| Action | Member | Organizer |
|---|---|---|
| View schedule, menu, sponsors, RSVP names, headcount | ✅ | ✅ |
| Watch the kitchen view (everyone's orders, read-only) | ✅ | ✅ |
| Sponsor a menu item / remove own unpaid sponsorship | ✅ | ✅ |
| See own sponsorships' payment status | ✅ | ✅ |
| See everyone's payment status, mark Paid | — | ✅ |
| RSVP / order for self | ✅ | ✅ |
| Edit menu item & sponsors needed, skip/restore weeks, add/remove any sponsorship | — | ✅ |
| Open/close ordering, advance orders, add walk-ins/guests | — | ✅ |

## Edge cases
- Organizer forgets to close ordering → "still open" warning Thursday afternoon, then auto-closed at midnight NY (see BreakfastEvents).
- Member RSVP'd No but orders → allowed, counted as walk-in.
- Sponsor leaves the company with an unpaid sponsorship → still listed on Payments for Chelsea to resolve.
