// Slack Web API client for posting to #108state (docs/slack-integration.md).
// Never throws on Slack or network errors and never logs or returns the bot token.
// SLACK_API_BASE points it at a fake Slack in local dev and e2e tests.
import "server-only";

type FetchLike = typeof fetch;

export const DEFAULT_SLACK_API_BASE = "https://slack.com/api";

export type SlackConfig = { token: string; channelId: string; apiBase: string };

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
  return { token, channelId, apiBase };
}

export function isSlackConfigured(env: Record<string, string | undefined> = process.env) {
  return slackConfig(env) !== null;
}

/** chat.postMessage to the configured channel. */
export async function postToChannel(
  message: SlackMessage,
  {
    config = slackConfig(),
    fetch: fetchImpl = fetch,
  }: { config?: SlackConfig | null; fetch?: FetchLike } = {},
): Promise<SlackPostResult> {
  if (!config) return { ok: false, reason: "not-configured" };
  const fail = (error: string): SlackPostResult => ({
    ok: false,
    reason: "slack-error",
    error: error.split(config.token).join("[redacted]"),
  });
  try {
    const res = await fetchImpl(`${config.apiBase}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: config.channelId, unfurl_links: false, ...message }),
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
