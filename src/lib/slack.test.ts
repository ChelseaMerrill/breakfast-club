import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SLACK_API_BASE,
  isSlackConfigured,
  postDirectMessage,
  postToChannel,
  slackConfig,
} from "./slack";

const TOKEN = "xoxb-secret-123";
const config = { token: TOKEN, channelId: "C108", apiBase: "http://fake.test/api" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.restoreAllMocks());

describe("slackConfig", () => {
  it("needs both the bot token and the channel", () => {
    expect(slackConfig({})).toBeNull();
    expect(slackConfig({ SLACK_BOT_TOKEN: TOKEN })).toBeNull();
    expect(slackConfig({ SLACK_CHANNEL_ID: "C108", SLACK_BOT_TOKEN: " " })).toBeNull();
    expect(isSlackConfigured({ SLACK_BOT_TOKEN: TOKEN, SLACK_CHANNEL_ID: "C108" })).toBe(true);
  });

  it("defaults to slack.com and trims a trailing slash from SLACK_API_BASE", () => {
    expect(slackConfig({ SLACK_BOT_TOKEN: TOKEN, SLACK_CHANNEL_ID: "C108" })?.apiBase).toBe(
      DEFAULT_SLACK_API_BASE,
    );
    expect(
      slackConfig({
        SLACK_BOT_TOKEN: TOKEN,
        SLACK_CHANNEL_ID: "C108",
        SLACK_API_BASE: "http://127.0.0.1:3901/api/",
      })?.apiBase,
    ).toBe("http://127.0.0.1:3901/api");
  });
});

describe("postToChannel", () => {
  it("posts chat.postMessage to the channel with the bot token", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ ok: true, ts: "1.2" }));
    const result = await postToChannel({ text: "hi", blocks: [] }, { config, fetch });

    expect(result).toEqual({ ok: true, ts: "1.2" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://fake.test/api/chat.postMessage");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body)).toMatchObject({ channel: "C108", text: "hi", blocks: [] });
  });

  it("returns Slack's error instead of throwing", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ ok: false, error: "not_in_channel" }));
    expect(await postToChannel({ text: "hi" }, { config, fetch })).toEqual({
      ok: false,
      reason: "slack-error",
      error: "not_in_channel",
    });
  });

  it("handles non-JSON responses and network failures", async () => {
    const html = vi.fn().mockResolvedValue(new Response("<html>", { status: 503 }));
    expect(await postToChannel({ text: "hi" }, { config, fetch: html })).toMatchObject({
      reason: "slack-error",
      error: "HTTP 503",
    });
    const down = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    expect(await postToChannel({ text: "hi" }, { config, fetch: down })).toMatchObject({
      reason: "slack-error",
      error: "fetch failed",
    });
  });

  it("does nothing when Slack isn't configured", async () => {
    const fetch = vi.fn();
    expect(await postToChannel({ text: "hi" }, { config: null, fetch })).toEqual({
      ok: false,
      reason: "not-configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never leaks the token in results or logs", async () => {
    const logs = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const echo = vi.fn().mockRejectedValue(new Error(`bad header Bearer ${TOKEN}`));
    const result = await postToChannel({ text: "hi" }, { config, fetch: echo });

    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(JSON.stringify(result)).toContain("[redacted]");
    for (const spy of logs) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN);
    }
  });
});

describe("postDirectMessage", () => {
  it("sends to the person (their user ID as channel), not #108state", async () => {
    const fetch = vi.fn().mockResolvedValue(reply({ ok: true, ts: "9.9" }));
    const result = await postDirectMessage("U03ABC", { text: "ready" }, { config, fetch });
    expect(result).toEqual({ ok: true, ts: "9.9" });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.channel).toBe("U03ABC");
    expect(body.text).toBe("ready");
  });

  it("does nothing when Slack is not configured", async () => {
    const fetch = vi.fn();
    expect(await postDirectMessage("U03ABC", { text: "x" }, { config: null, fetch })).toEqual({
      ok: false,
      reason: "not-configured",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
