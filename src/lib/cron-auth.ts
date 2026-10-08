// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fails closed: no CRON_SECRET
// configured means every request is refused. Compares SHA-256 digests in constant time,
// so neither the secret's content nor its length leaks through timing.
import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unauthorized" | "not-configured";

export function checkCronAuth(authorization: string | null, secret: string | undefined): CronAuth {
  if (!secret) return "not-configured";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  const ok = timingSafeEqual(digest(authorization ?? ""), digest(`Bearer ${secret}`));
  return ok ? "ok" : "unauthorized";
}
