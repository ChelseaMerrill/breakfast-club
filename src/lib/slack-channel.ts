// #108state membership gate (docs/slack-integration.md → Channel-membership gate).
// Fails closed: any missing config or Slack error means "not a member".

type FetchLike = typeof fetch;

type MembersPage = {
  ok: boolean;
  error?: string;
  members?: string[];
  response_metadata?: { next_cursor?: string };
};

export type ChannelMembershipOptions = {
  token: string | undefined;
  channelId: string | undefined;
  fetch?: FetchLike;
  ttlMs?: number;
  now?: () => number;
};

export function createChannelMembership({
  token,
  channelId,
  fetch: fetchImpl = fetch,
  ttlMs = 5 * 60 * 1000,
  now = Date.now,
}: ChannelMembershipOptions) {
  let cache: { members: Set<string>; at: number } | null = null;

  async function loadMembers(): Promise<Set<string>> {
    if (!token || !channelId) throw new Error("SLACK_BOT_TOKEN and SLACK_CHANNEL_ID are required");
    const members = new Set<string>();
    let cursor = "";
    do {
      const params = new URLSearchParams({ channel: channelId, limit: "200" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetchImpl(`https://slack.com/api/conversations.members?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const page = (await res.json()) as MembersPage;
      if (!page.ok) throw new Error(`conversations.members failed: ${page.error ?? res.status}`);
      page.members?.forEach((id) => members.add(id));
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor);
    return members;
  }

  return {
    async isMember(slackUserId: string): Promise<boolean> {
      try {
        if (!cache || now() - cache.at > ttlMs) {
          cache = { members: await loadMembers(), at: now() };
        }
        return cache.members.has(slackUserId);
      } catch (err) {
        console.error("[slack-channel] membership check failed; denying", err);
        return false;
      }
    },
  };
}

/** Shared instance for the app, configured from env. */
export const channelMembership = createChannelMembership({
  token: process.env.SLACK_BOT_TOKEN,
  channelId: process.env.SLACK_CHANNEL_ID,
});

/** How often a signed-in session re-checks #108state (decision #28). */
export const CHANNEL_RECHECK_MS = 3 * 60 * 60 * 1000;

export function needsChannelRecheck(checkedAt: number | undefined, now = Date.now()): boolean {
  return !checkedAt || now - checkedAt >= CHANNEL_RECHECK_MS;
}
