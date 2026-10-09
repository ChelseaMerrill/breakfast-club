// A stand-in for the Slack Web API, so the reminder can be tested before the real Slack app
// exists. The dev server posts to it via SLACK_API_BASE (in .env, e.g.
// http://127.0.0.1:3901/api); this records every chat.postMessage call.
import "dotenv/config";
import { createServer, type Server } from "node:http";

export type SlackCall = {
  method: string; // "chat.postMessage"
  authorization: string | undefined;
  body: {
    channel?: string;
    text?: string;
    blocks?: { type: string; elements?: { text?: unknown; url?: string }[] }[];
  };
};

/** True when the dev server is set up to post to the fake (both bot vars + SLACK_API_BASE). */
export const fakeSlackConfigured = Boolean(
  process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID && process.env.SLACK_API_BASE,
);

export async function startFakeSlack() {
  const base = new URL(process.env.SLACK_API_BASE!);
  const calls: SlackCall[] = [];
  let nextError: string | null = null;
  let allError: string | null = null;

  const server: Server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const method = (req.url ?? "").split("?")[0].split("/").pop() ?? "";
      calls.push({
        method,
        authorization: req.headers.authorization,
        body: raw ? JSON.parse(raw) : {},
      });
      res.setHeader("Content-Type", "application/json");
      if (nextError || allError) {
        res.end(JSON.stringify({ ok: false, error: nextError ?? allError }));
        nextError = null;
      } else {
        res.end(JSON.stringify({ ok: true, channel: process.env.SLACK_CHANNEL_ID, ts: "1.000" }));
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(base.port), base.hostname, resolve);
  });

  return {
    calls,
    /** Make the next call fail the way Slack does (HTTP 200, ok: false). */
    failNext(error: string) {
      nextError = error;
    },
    /** Make every call fail until reset(). */
    failAll(error: string) {
      allError = error;
    },
    reset() {
      calls.length = 0;
      nextError = null;
      allError = null;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
