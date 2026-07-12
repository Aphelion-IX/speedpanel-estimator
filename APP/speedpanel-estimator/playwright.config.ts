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
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Against the production build (not `npm run dev`) -- matches what
    // actually ships, and what the GitHub Actions workflow runs after its
    // own `npm run build` step (see .github/workflows/e2e.yml).
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
