// Sponsor wording from design/Breakfast Club.dc.html (Schedule, Home menu card, Slack preview).

export type SponsorshipNames = {
  teamName: string | null;
  sponsorName: string | null;
  members: { name: string }[];
};

/** "Delivery team", "Fred De Koker", or "Jordan Reyes & Jane Doe". */
export function sponsorshipLabel(s: SponsorshipNames): string {
  return s.teamName ?? s.sponsorName ?? s.members.map((m) => m.name).join(" & ");
}

export const formatDollars = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export type SponsorSummary = { text: string; fullySponsored: boolean; needed: number };

/** "Sponsored by Corbin", "Sponsored by Fred · needs 1 more", "Needs 2 sponsors ($30 each)". */
export function sponsorSummary(
  sponsorships: SponsorshipNames[],
  sponsorsNeeded: number,
  amountCents: number,
): SponsorSummary {
  const names = sponsorships.map(sponsorshipLabel);
  const needed = Math.max(0, sponsorsNeeded - names.length);
  if (names.length === 0) {
    const noun = sponsorsNeeded === 1 ? "sponsor" : "sponsors";
    return {
      text: `Needs ${sponsorsNeeded} ${noun} (${formatDollars(amountCents)} each)`,
      fullySponsored: false,
      needed,
    };
  }
  return {
    text: `Sponsored by ${names.join(", ")}${needed > 0 ? ` · needs ${needed} more` : ""}`,
    fullySponsored: needed === 0,
    needed,
  };
}
