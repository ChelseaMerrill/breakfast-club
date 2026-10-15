// Runs a reminder cron on staging by hand (Vercel only runs crons in production).
//
//   npm run staging:cron -- weekly-reminder
//   npm run staging:cron -- payment-reminder --now 2026-10-14T15:30:00Z
//
// `--now` pretends it's that moment, so a reminder can be tried on any day. Settings come
// from `.env.staging` (git-ignored); see docs/environments.md.
import { config } from "dotenv";

config({ path: ".env.staging", quiet: true });

const ROUTES = ["weekly-reminder", "payment-reminder"];
const [route, flag, now] = process.argv.slice(2);
const { STAGING_URL, STAGING_CRON_SECRET, STAGING_BYPASS_SECRET } = process.env;

if (!ROUTES.includes(route) || (flag && (flag !== "--now" || !now))) {
  console.error(`Usage: npm run staging:cron -- <${ROUTES.join("|")}> [--now <ISO time>]`);
  process.exit(1);
}
if (!STAGING_URL || !STAGING_CRON_SECRET) {
  console.error("Set STAGING_URL and STAGING_CRON_SECRET in .env.staging (docs/environments.md).");
  process.exit(1);
}

const url = new URL(`/api/cron/${route}`, STAGING_URL);
if (now) url.searchParams.set("now", now);
const headers = { Authorization: `Bearer ${STAGING_CRON_SECRET}` };
// Staging sits behind Vercel Authentication; this lets the request through.
if (STAGING_BYPASS_SECRET) headers["x-vercel-protection-bypass"] = STAGING_BYPASS_SECRET;

const res = await fetch(url, { headers, redirect: "manual" });
const text = await res.text();
console.log(`${res.status} ${url.pathname}${url.search}`);
console.log(text.startsWith("{") ? text : text.slice(0, 200));
if (!res.ok) process.exit(1);
