import { test, expect } from "@playwright/test";
import { signInAsProjectManager, signInAsOutsider, signInAsAdmin, signOut } from "./fixtures/auth";
import { PROJECT_A_INSTALL_REVIEW, PROJECT_B_INSTALL_REVIEW } from "./fixtures/seedIds";
import { expectTextVisibleWithSnapshot } from "./test-utils";

// =============================================================================
// Automated replacement for the manual "staff smoke test" -- the Project
// Reviews queue (AdminProjectsPage.tsx) is scoped to a staff member's
// assigned companies client-side (useMyQueueScope/applyQueueScope), on top
// of the broader is_admin() RLS read grant every staff account has
// server-side (see supabase/tests/database/03_project_and_order_access.test.sql's
// documented finding). This file exercises both layers together, as a real
// signed-in browser session would encounter them:
//   - project-manager (staff, assigned to Company A only) sees only Company
//     A's review queue, no super-admin-only nav, and is blocked from other
//     role-gated sections by direct navigation.
//   - outsider (Company B customer, not staff) is backstopped by RLS alone
//     -- adminSectionAccess.ts's grandfather rule lets a staff_role=null
//     account reach the page client-side, but can_view_project()/RLS still
//     only returns Company B's own rows, so Company A never appears.
//   - admin (super_admin) sees the unscoped, cross-company view.
// =============================================================================

test.describe("scoped queue: Project Reviews", () => {
  test("project-manager sees only Company A's review queue, no cross-company or super-admin controls", async ({ page }) => {
    await signInAsProjectManager(page);

    await page.goto("/#/admin/projectReviews");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    // wait for seeded project A row and assert it's visible
    await page.waitForSelector(`[data-testid="project-row-${PROJECT_A_INSTALL_REVIEW}"]`, { timeout: 20_000 });
    await expect(page.locator(`[data-testid="project-name-${PROJECT_A_INSTALL_REVIEW}"]`)).toBeVisible();

    // ensure B not visible
    await expect(page.locator(`[data-testid="project-row-${PROJECT_B_INSTALL_REVIEW}"]`)).not.toBeVisible();

    // Dashboard: only the one section this role is granted (Workflow >
    // Project Reviews) renders -- no other Workflow tiles, and no
    // People/Reports/Catalog groups at all (those are super_admin/null-only,
    // see adminSectionAccess.ts).
    await page.goto("/#/admin");
    await expect(page.getByRole("button", { name: /Project Reviews/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Requests$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Orders$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Manufacturing/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Users$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Companies$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Permissions$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /^Analytics$/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Audit Log/i })).not.toBeVisible();

    // Direct navigation to a section outside this role's scope -- no
    // per-company queue URL exists in this app (scoping is by staff_role,
    // not a route param), so the equivalent "reach into somewhere you don't
    // belong via the address bar" check is a role-gated section instead.
    await page.goto("/#/admin/companies");
    await expect(page.getByText("Not part of your role")).toBeVisible();

    await signOut(page);
  });

  test("outsider (non-staff, Company B) never sees Company A's queue items", async ({ page }) => {
    await signInAsOutsider(page);

    await page.goto("/#/admin/projectReviews");
    await page.waitForSelector(`[data-testid="project-row-${PROJECT_B_INSTALL_REVIEW}"]`, { timeout: 20_000 });
    await expect(page.locator(`[data-testid="project-name-${PROJECT_B_INSTALL_REVIEW}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="project-row-${PROJECT_A_INSTALL_REVIEW}"]`)).not.toBeVisible();

    await signOut(page);
  });

  test("super admin sees the broader, cross-company administrative view", async ({ page }) => {
    await signInAsAdmin(page);

    await page.goto("/#/admin/projectReviews");
    await page.waitForSelector(`[data-testid="project-row-${PROJECT_A_INSTALL_REVIEW}"]`, { timeout: 20_000 });
    await expect(page.locator(`[data-testid="project-name-${PROJECT_A_INSTALL_REVIEW}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="project-name-${PROJECT_B_INSTALL_REVIEW}"]`)).toBeVisible();

    await signOut(page);
  });
});
