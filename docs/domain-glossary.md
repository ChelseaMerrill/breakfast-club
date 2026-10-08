# Domain Glossary

Use these names in code, UI copy, and conversation. Don't introduce synonyms.

| Term | Meaning | Don't call it |
|---|---|---|
| **Organizer** | Admin who runs and cooks breakfast (Chelsea) | admin user, chef, host |
| **Member** | Any signed-in coworker | user (in UI), attendee |
| **Guest** | Someone with no account (e.g. a visiting client) whose order the organizer enters by name | visitor, anonymous |
| **BreakfastEvent** | One Thursday breakfast | week, session, meal |
| **Skipped** | A Thursday with no breakfast (holiday) — no reminder sent | — |
| **Menu** | The list of MenuItems for one BreakfastEvent | — |
| **MenuItem** | Something on a Thursday's menu (e.g. Pancakes) | dish, product |
| **ItemOption** | A choice on a MenuItem (e.g. Eggs → Scrambled) | modifier, variant |
| **Sponsorship** | A name (one person, two people, or a team) next to a MenuItem, meaning they pay $30 to the organizer | claim, donation |
| **Sponsor** | The person/people/team on a Sponsorship | payer |
| **Sponsorship amount** | What each Sponsorship owes — $30 (setting) | fee, price |
| **Paid** | Organizer has confirmed the Sponsorship's $30 was received | settled |
| **Rsvp** | A member's Yes/No answer for a BreakfastEvent | signup, poll vote |
| **Headcount** | Yes RSVPs + walk-in orders without a Yes; visible to everyone | — |
| **Ordering enabled** | Whether this Thursday takes orders at all (off for e.g. bagels) | — |
| **Open / Close ordering** | Organizer's manual switch for accepting orders | ordering window |
| **Order** | One person's request for a BreakfastEvent; contains OrderLines | ticket |
| **Walk-in** | An Order from someone who didn't RSVP Yes (member or guest) | — |
| **OrderLine** | One MenuItem (+ options, qty) within an Order | item |
| **OrderStatus** | PLACED → COOKING → READY → PICKED_UP (or CANCELLED) | — |
| **Kitchen queue** | Live order board everyone can watch; only the organizer moves orders (renamed from "kitchen view") | dashboard, kitchen view |
| **Sponsors needed** | How many Sponsorships a Thursday's menu item is looking for (default 1) | slots |
| **Reminder** | The Tuesday Slack post to #108state | notification |
