// The Tuesday reminder (docs/slack-integration.md → Message). One builder feeds both the
// Settings preview and, in M7, the real Slack post, so they always say the same thing.
// Payment status is never included.
import { formatDollars, sponsorshipLabel, type SponsorshipNames } from "@/lib/sponsorship-display";
import { formatThursday } from "@/lib/thursdays";

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type ReminderInput = {
  date: Date;
  orderingEnabled: boolean;
  item: { name: string; sponsorships: SponsorshipNames[] } | null;
  sponsorsNeeded: number;
  amountCents: number;
  headcount: number;
  rsvpDeadline: { weekday: number; time: string }; // AppSettings rsvpDeadlineWeekday / Time
};

export type ReminderMessage = {
  title: string; // "Breakfast Club — Thursday, Oct 8"
  menu: { name: string; sponsorText: string }[]; // empty → "Menu coming soon!"
  notes: string[]; // italic lines, e.g. "No orders needed this week — just RSVP!"
  headcount: number;
  rsvpBy: string; // "Wednesday 5pm"
};

/** "sponsored by Corbin", "sponsored by Fred De Koker (needs 1 more)", "needs 2 sponsor(s) ($30 each)". */
export function slackSponsorText(
  sponsorships: SponsorshipNames[],
  sponsorsNeeded: number,
  amountCents: number,
): string {
  const names = sponsorships.map(sponsorshipLabel);
  const left = Math.max(0, sponsorsNeeded - names.length);
  if (!names.length)
    return `needs ${sponsorsNeeded} sponsor(s) (${formatDollars(amountCents)} each)`;
  return `sponsored by ${names.join(", ")}${left > 0 ? ` (needs ${left} more)` : ""}`;
}

export function rsvpByText({ weekday, time }: { weekday: number; time: string }): string {
  const [h, m] = time.split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${WEEKDAY_NAMES[weekday]} ${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export function buildReminder(input: ReminderInput): ReminderMessage {
  const menu = input.item
    ? [
        {
          name: input.item.name,
          sponsorText: slackSponsorText(
            input.item.sponsorships,
            input.sponsorsNeeded,
            input.amountCents,
          ),
        },
      ]
    : [];
  const notes: string[] = [];
  if (!menu.length) notes.push("Menu coming soon!");
  if (!input.orderingEnabled) notes.push("No orders needed this week — just RSVP!");
  return {
    title: `Breakfast Club — ${formatThursday(input.date)}`,
    menu,
    notes,
    headcount: input.headcount,
    rsvpBy: rsvpByText(input.rsvpDeadline),
  };
}

/** Slack mrkdwn text for the message body (M7 adds the RSVP / Sponsor an item buttons). */
export function reminderMrkdwn(msg: ReminderMessage): string {
  return [
    `*${msg.title}*`,
    ...(msg.menu.length
      ? ["On the menu:", ...msg.menu.map((m) => `• ${m.name} — _${m.sponsorText}_`)]
      : []),
    ...msg.notes.map((n) => `_${n}_`),
    `Headcount so far: *${msg.headcount}*`,
    `RSVP by *${msg.rsvpBy}*.`,
  ].join("\n");
}
