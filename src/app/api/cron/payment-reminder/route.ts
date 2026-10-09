import { checkCronAuth } from "@/lib/cron-auth";
import { runPaymentReminder } from "@/lib/payment-reminder-run";
import { clockOverride } from "@/lib/reminder-decision";

// Wednesday 11am ET unpaid-sponsor DMs (open-questions #56). Called by the two Wednesday
// Vercel Crons in vercel.json with `Authorization: Bearer $CRON_SECRET`; refuses everything
// if CRON_SECRET isn't set. `?now=` works only under `next dev` (see clockOverride).
export async function GET(request: Request) {
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "not-configured") {
    return Response.json({ status: "error", error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (auth === "unauthorized") {
    return Response.json({ status: "error", error: "unauthorized" }, { status: 401 });
  }
  const override = clockOverride(
    new URL(request.url).searchParams.get("now"),
    process.env.NODE_ENV,
  );
  try {
    const result = await runPaymentReminder(override ?? new Date());
    return Response.json(result, { status: result.status === "error" ? 502 : 200 });
  } catch (err) {
    console.error("[payment-reminder] failed", err);
    return Response.json({ status: "error", error: "payment reminder failed" }, { status: 500 });
  }
}
