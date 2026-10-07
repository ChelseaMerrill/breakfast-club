import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a local dev server and the Neon `dev` branch (from .env),
// signing in through the dev-only "Sign in as…" provider. Tests clean up what they change.
// Next 16 allows one dev server per project, so share the usual port: reuse `npm run dev`
// if it is already running, otherwise start one. E2E_PORT lets a second checkout (a git
// worktree) run its own server and tests side by side.
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1, // tests share the dev database
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
