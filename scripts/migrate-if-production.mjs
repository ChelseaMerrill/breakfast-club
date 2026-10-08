// Vercel build step: apply database migrations for production deploys only.
// Preview builds of unmerged branches must never change a database's schema; the dev
// database is migrated locally with `npm run db:migrate`.
import { execSync } from "node:child_process";

if (process.env.VERCEL_ENV === "production") {
  console.log("[migrate] production build: running prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"})`);
}
