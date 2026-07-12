import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// .env.test carries the seeded persona credentials (see
// .env.test.example/e2e/README.md) -- a non-standard filename, so it's
// loaded explicitly rather than relying on dotenv's default ".env" lookup.
loadEnv({ path: ".env.test" });

// Role-based auth/RLS E2E suite -- see e2e/README.md for the full persona
// table, the role matrix each spec file exercises, and how to run this
// against a real environment (requires real network access to Supabase's
// Auth endpoint -- not available from every sandbox/CI runner).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared seeded accounts -- avoid concurrent-session interference
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://localhost:5183",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 5183",
    url: "http://localhost:5183",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
