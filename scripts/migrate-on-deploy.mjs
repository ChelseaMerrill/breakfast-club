// Vercel build step: apply database migrations for production and staging deploys only.
// Production migrates the live database; the `staging` branch migrates the dev database it
// points at, so a schema change is tried there first (docs/environments.md). Preview builds
// of other branches must never change a database's schema; locally use `npm run db:migrate`.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const branch = process.env.VERCEL_GIT_COMMIT_REF;

if (env === "production" || (env === "preview" && branch === "staging")) {
  console.log(
    `[migrate] ${env === "production" ? "production" : "staging"} build: running prisma migrate deploy`,
  );
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} else {
  console.log(`[migrate] skipped (VERCEL_ENV=${env ?? "unset"}, branch=${branch ?? "unset"})`);
}
