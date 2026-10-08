import { checkCronAuth } from "@/lib/cron-auth";
import { runWeeklyReminder } from "@/lib/reminder";
import { clockOverride } from "@/lib/reminder-decision";

// Tuesday reminder (docs/slack-integration.md). Called by the two Vercel Crons in
// vercel.json with `Authorization: Bearer $CRON_SECRET`. API routes skip the auth proxy,
// so this route checks the secret itself and refuses everything if it isn't set.
export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "not-configured") {
    return Response.json({ status: "error", error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (auth === "unauthorized") {
    return Response.json({ status: "error", error: "unauthorized" }, { status: 401 });
  }

  // `?now=` only works under `next dev` (see clockOverride); production always uses the clock.
  const override = clockOverride(
    new URL(request.url).searchParams.get("now"),
    process.env.NODE_ENV,
  );
  try {
    const result = await runWeeklyReminder(override ?? new Date());
    return Response.json(result, { status: result.status === "error" ? 502 : 200 });
  } catch (err) {
    console.error("[weekly-reminder] failed", err);
    return Response.json({ status: "error", error: "reminder failed" }, { status: 500 });
  }
}
