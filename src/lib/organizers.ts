// Who is an organizer (docs/business-rules.md → Sign-in & access). Sign-in is Slack only
// (open-questions #42); who may sign in is the #108state gate in src/lib/slack-channel.ts.

/** Organizers come only from ORGANIZER_SLACK_IDS (comma-separated Slack user IDs). */
export function isOrganizer(
  slackUserId: string | null | undefined,
  raw: string | undefined = process.env.ORGANIZER_SLACK_IDS,
): boolean {
  if (!slackUserId) return false;
  const ids = (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(slackUserId.trim());
}
