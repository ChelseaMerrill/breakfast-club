import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Runs a task from e2e/db-task.mts against the dev database and returns its JSON output. */
export function dbTask<T>(task: string, ...args: string[]): T {
  const root = path.join(__dirname, "..");
  // Run tsx's CLI with this Node directly: no shell, so arguments are passed as-is.
  const out = execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(__dirname, "db-task.mts"),
      task,
      ...args,
    ],
    { cwd: root, encoding: "utf8" },
  );
  return JSON.parse(out.trim().split("\n").pop()!) as T;
}

/** Signs the page's browser context in as a seed member via the dev-only provider. */
export async function signInAs(page: Page, name: string) {
  const memberId = dbTask<string>("member-id", name);
  const { csrfToken } = await (await page.request.get("/api/auth/csrf")).json();
  const res = await page.request.post("/api/auth/callback/dev-login", {
    form: { csrfToken, memberId, callbackUrl: "/" },
    maxRedirects: 0,
  });
  if (res.status() !== 302 || res.headers().location?.includes("error")) {
    throw new Error(`Sign-in as ${name} failed: ${res.status()} ${res.headers().location}`);
  }
}
