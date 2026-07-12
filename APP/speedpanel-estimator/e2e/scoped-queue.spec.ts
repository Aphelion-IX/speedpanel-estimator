import { test, expect } from "@playwright/test";
import { signInAsProjectManager, signInAsOutsider, signInAsAdmin, signOut } from "./fixtures/auth";
import { PROJECT_A_INSTALL_REVIEW_NAME, PROJECT_B_INSTALL_REVIEW_NAME } from "./fixtures/seedIds";

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

// Matches PROJECT_A/B_INSTALL_REVIEW_NAME with tolerance for dash-character
// and whitespace drift (e.g. an en/em dash vs. "--") in the seeded display
// name, rather than requiring an exact string match.
const flexibleNameMatch = (name: string) =>
  new RegExp(name.replace(/[-\s]+/g, "\\s*[-\\u2010-\\u2015]?\\s*"), "i");

const PROJECT_A_NAME_RE = flexibleNameMatch(PROJECT_A_INSTALL_REVIEW_NAME);
const PROJECT_B_NAME_RE = flexibleNameMatch(PROJECT_B_INSTALL_REVIEW_NAME);

test.describe("scoped queue: Project Reviews", () => {
  test("project-manager sees only Company A's review queue, no cross-company or super-admin controls", async ({ page }) => {
    await signInAsProjectManager(page);

    await page.goto("/#/admin/projectReviews");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();
    // Two sequential Supabase round trips gate this queue (staff_assignments
    // scope resolution, then the scoped projects fetch -- see
    // useMyQueueScope/adminProjectsStore.ts) -- give the FIRST (positive)
    // assertion more room than the 5s default on a cold CI connection, so
    // the page has genuinely finished loading before the negative assertion
    // right after it.
    //
    // For a project_manager viewer specifically, AdminProjectsPage.tsx
    // renders this same project name TWICE -- once as a review-queue row,
    // once again in the "My active projects" section below it
    // (MyActiveProjectsSection, PM-only) -- both genuinely correct, not a
    // bug, so .first() (the review-queue row, which renders first in DOM
    // order) disambiguates rather than hitting a strict-mode violation.
    await expect(page.getByText(PROJECT_A_NAME_RE).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(PROJECT_B_NAME_RE)).not.toBeVisible();

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

    // adminSectionAccess.ts's grandfather rule (staff_role === null passes)
    // lets a non-staff account reach this page client-side -- RLS is the
    // real backstop here, not the nav gate. See can_view_project() /
    // 03_project_and_order_access.test.sql's "outsider: sees zero Company A
    // projects" assertion for the server-side half of this same guarantee.
    await page.goto("/#/admin/projectReviews");
    // Positive assertion first (see the generous-timeout comment above) so
    // the negative one right after it isn't just catching the page mid-load.
    // outsider isn't a project_manager, so MyActiveProjectsSection never
    // renders here -- no duplicate-match risk, unlike the PM test above.
    await expect(page.getByText(PROJECT_B_NAME_RE)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(PROJECT_A_NAME_RE)).not.toBeVisible();

    await signOut(page);
  });

  test("super admin sees the broader, cross-company administrative view", async ({ page }) => {
    await signInAsAdmin(page);

    // admin is super_admin, not project_manager, so MyActiveProjectsSection
    // never renders here either -- no duplicate-match risk.
    await page.goto("/#/admin/projectReviews");
    await expect(page.getByText(PROJECT_A_NAME_RE)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(PROJECT_B_NAME_RE)).toBeVisible();

    await signOut(page);
  });
});
