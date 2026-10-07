import { describe, expect, it, vi } from "vitest";
import { CHANNEL_RECHECK_MS, createChannelMembership, needsChannelRecheck } from "./slack-channel";

const page = (members: string[], next_cursor = "") =>
  new Response(JSON.stringify({ ok: true, members, response_metadata: { next_cursor } }));

describe("createChannelMembership", () => {
  it("pages through conversations.members", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(page(["U1", "U2"], "next"))
      .mockResolvedValueOnce(page(["U3"]));
    const gate = createChannelMembership({ token: "xoxb-test", channelId: "C108", fetch });

    expect(await gate.isMember("U3")).toBe(true);
    expect(await gate.isMember("U9")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2); // second lookup served from cache
    expect(String(fetch.mock.calls[1][0])).toContain("cursor=next");
  });

  it("refreshes after the cache expires", async () => {
    let t = 0;
    const fetch = vi.fn().mockImplementation(async () => page(t < 1000 ? ["U1"] : []));
    const gate = createChannelMembership({
      token: "xoxb-test",
      channelId: "C108",
      fetch,
      ttlMs: 500,
      now: () => t,
    });

    expect(await gate.isMember("U1")).toBe(true);
    t = 2000; // U1 has left the channel
    expect(await gate.isMember("U1")).toBe(false);
  });

  it("fails closed when Slack errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "not_in_channel" })));
    const gate = createChannelMembership({ token: "xoxb-test", channelId: "C108", fetch });
    expect(await gate.isMember("U1")).toBe(false);
  });

  it("fails closed when the bot token or channel is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn();
    const gate = createChannelMembership({ token: undefined, channelId: "C108", fetch });
    expect(await gate.isMember("U1")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("needsChannelRecheck", () => {
  it("rechecks when never checked or after 3 hours", () => {
    expect(needsChannelRecheck(undefined, 0)).toBe(true);
    expect(needsChannelRecheck(1000, 1000 + CHANNEL_RECHECK_MS - 1)).toBe(false);
    expect(needsChannelRecheck(1000, 1000 + CHANNEL_RECHECK_MS)).toBe(true);
  });
});
