import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a local dev server and the Neon `dev` branch (from .env),
// signing in through the dev-only "Sign in as…" provider. Tests clean up what they change.
const PORT = 3100;

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
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/signin`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
