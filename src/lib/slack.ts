// Slack Web API client for posting to #108state (docs/slack-integration.md).
// Never throws on Slack or network errors and never logs or returns the bot token.
// SLACK_API_BASE points it at a fake Slack in local dev and e2e tests.
import "server-only";

type FetchLike = typeof fetch;

export const DEFAULT_SLACK_API_BASE = "https://slack.com/api";

/** The live channel. Only production may post to it (docs/environments.md). */
export const LIVE_CHANNEL_NAME = "108state";

export type SlackConfig = {
  token: string;
  channelId: string;
  apiBase: string;
  /** Outside production, look up the channel's name and refuse to post to #108state. */
  guardLiveChannel?: boolean;
};

export type SlackPostResult =
  | { ok: true; ts?: string }
  | { ok: false; reason: "not-configured" }
  | { ok: false; reason: "slack-error"; error: string };

/** A Block Kit block; kept loose on purpose (we only build section / actions / context). */
export type SlackBlock = Record<string, unknown>;

export type SlackMessage = { text: string; blocks?: SlackBlock[] };

/** The bot's config from env, or null when Slack isn't connected yet. */
export function slackConfig(
  env: Record<string, string | undefined> = process.env,
): SlackConfig | null {
  const token = env.SLACK_BOT_TOKEN?.trim();
  const channelId = env.SLACK_CHANNEL_ID?.trim();
  if (!token || !channelId) return null;
  const apiBase = (env.SLACK_API_BASE?.trim() || DEFAULT_SLACK_API_BASE).replace(/\/+$/, "");
  // Staging and local dev share the live bot token; the fake Slack needs no guard.
  const guardLiveChannel = env.VERCEL_ENV !== "production" && apiBase === DEFAULT_SLACK_API_BASE;
  return { token, channelId, apiBase, guardLiveChannel };
}

export function isSlackConfigured(env: Record<string, string | undefined> = process.env) {
  return slackConfig(env) !== null;
}

type PostOptions = { config?: SlackConfig | null; fetch?: FetchLike };

/** chat.postMessage to the configured channel (#108state). */
export function postToChannel(message: SlackMessage, options: PostOptions = {}) {
  return postMessage("channel", message, options);
}

/**
 * chat.postMessage to one person: passing their Slack user ID as `channel` opens the
 * bot's DM with them (needs only chat:write). Used for "your order is ready".
 */
export function postDirectMessage(
  slackUserId: string,
  message: SlackMessage,
  options: PostOptions = {},
) {
  return postMessage(slackUserId, message, options);
}

async function postMessage(
  target: "channel" | string,
  message: SlackMessage,
  { config = slackConfig(), fetch: fetchImpl = fetch }: PostOptions,
): Promise<SlackPostResult> {
  if (!config) return { ok: false, reason: "not-configured" };
  const channel = target === "channel" ? config.channelId : target;
  const fail = (error: string): SlackPostResult => ({
    ok: false,
    reason: "slack-error",
    error: error.split(config.token).join("[redacted]"),
  });
  try {
    if (target === "channel" && config.guardLiveChannel) {
      const blocked = await liveChannelBlock(config, fetchImpl);
      if (blocked) return fail(blocked);
    }
    const res = await fetchImpl(`${config.apiBase}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, unfurl_links: false, ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      ts?: string;
    } | null;
    if (body?.ok) return { ok: true, ts: body.ts };
    return fail(body?.error ?? `HTTP ${res.status}`);
  } catch (err) {
    return fail(
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "timeout"
          : err.message
        : "request failed",
    );
  }
}

// Channel IDs already confirmed not to be #108state (names don't change mid-process).
const safeChannels = new Set<string>();

/**
 * Why a non-production post must not go out, or null if it may. Fails closed: if Slack
 * can't tell us the channel's name, nothing is posted.
 */
async function liveChannelBlock(config: SlackConfig, fetchImpl: FetchLike): Promise<string | null> {
  if (safeChannels.has(config.channelId)) return null;
  const params = new URLSearchParams({ channel: config.channelId });
  const res = await fetchImpl(`${config.apiBase}/conversations.info?${params}`, {
    headers: { Authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    channel?: { name?: string };
  } | null;
  if (!body?.ok || !body.channel?.name) {
    return `couldn't check the channel outside production (${body?.error ?? `HTTP ${res.status}`})`;
  }
  if (body.channel.name === LIVE_CHANNEL_NAME) {
    return `only production posts to #${LIVE_CHANNEL_NAME}; set SLACK_CHANNEL_ID to the test channel`;
  }
  safeChannels.add(config.channelId);
  return null;
}
