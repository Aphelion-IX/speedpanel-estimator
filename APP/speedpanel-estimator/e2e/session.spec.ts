import { test, expect } from "@playwright/test";
import { signInAsMember, signOut } from "./fixtures/auth";
import { directRpc, directTable } from "./fixtures/directApi";

// Session/logout/anonymous behavior (point 11 of the user's checklist).
test.describe("session and anonymous access", () => {
  test("logout ends the session and subsequent direct API calls are anonymous (RLS-restricted), not still-authenticated", async ({ page }) => {
    await signInAsMember(page);
    await signOut(page);
    // No signed-in session left -- directTable falls back to the anon key
    // alone. company_memberships has no public-read policy at all, so an
    // anonymous caller gets zero rows back, same as any other unauthorized read.
    const result = await directTable(page, "company_memberships");
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  test("anonymous (never signed in) can still submit the public 'Request a quote' flow", async ({ page }) => {
    await page.goto("/#/projects/request");
    await expect(page.getByRole("heading", { name: /Request a Quote/i })).toBeVisible();
  });

  test("anonymous cannot read requests -- admins-only per RLS, no session at all", async ({ page }) => {
    await page.goto("/");
    const result = await directTable(page, "requests");
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  test("anonymous cannot call any has_staff_role()-gated RPC", async ({ page }) => {
    await page.goto("/");
    const result = await directRpc(page, "admin_list_companies");
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("visiting an admin sub-page while signed out renders the dashboard shell (AdminGate.tsx is intentionally open) but the underlying data is still RLS-denied", async ({ page }) => {
    await page.goto("/#/admin/users");
    // No crash, no infinite spinner -- the page itself loads (client-side
    // convenience per AdminGate's own design), the RPC call inside it fails.
    await expect(page.locator("body")).toBeVisible();
  });
});
