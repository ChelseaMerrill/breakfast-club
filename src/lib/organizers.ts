/** Organizers come only from ORGANIZER_SLACK_IDS (comma-separated Slack user IDs). */
export function organizerSlackIds(raw: string | undefined = process.env.ORGANIZER_SLACK_IDS) {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

export function isOrganizer(slackUserId: string, raw?: string): boolean {
  return organizerSlackIds(raw).has(slackUserId);
}
