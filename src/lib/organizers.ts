// Who may sign in, and who is an organizer (docs/business-rules.md → Sign-in & access).

function list(raw: string | undefined) {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type Identity = { email?: string | null; slackUserId?: string | null };

/**
 * Organizers come only from env: ORGANIZER_EMAILS (Google sign-in, interim) and
 * ORGANIZER_SLACK_IDS (Slack sign-in, once the Slack app exists).
 */
export function isOrganizer(
  { email, slackUserId }: Identity,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    (!!email && list(env.ORGANIZER_EMAILS).has(email.toLowerCase())) ||
    (!!slackUserId && list(env.ORGANIZER_SLACK_IDS).has(slackUserId.toLowerCase()))
  );
}

/** Google sign-in is limited to verified addresses on ALLOWED_EMAIL_DOMAINS (default jahnelgroup.com). */
export function isAllowedEmail(
  email: string | null | undefined,
  verified: boolean | undefined,
  raw: string | undefined = process.env.ALLOWED_EMAIL_DOMAINS,
): boolean {
  if (!email || verified !== true) return false;
  const domains = list(raw ?? "jahnelgroup.com");
  const domain = email.toLowerCase().split("@")[1];
  return !!domain && domains.has(domain);
}
