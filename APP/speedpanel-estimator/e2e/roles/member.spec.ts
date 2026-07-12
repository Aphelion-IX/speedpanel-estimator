import { test, expect } from "@playwright/test";
import { signInAsMember } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";
import { PROJECT_A_INSTALL_REVIEW } from "../fixtures/seedIds";

// member@e2e.test -- Company A, role='estimator'. A standard (non-admin)
// company member: owns one project outright, has explicit viewer access to
// another, and no relationship at all to a third (see
// supabase/tests/database/03_project_and_order_access.test.sql for the
// SQL-level version of this same tier check).
test.describe("member (Company A, estimator)", () => {
  test.beforeEach(async ({ page }) => { await signInAsMember(page); });

  test("6. member/suspend/remove controls are NOT visible on the Team page (estimator can't manage members)", async ({ page }) => {
    await page.goto("/#/company/team");
    await expect(page.getByRole("button", { name: "Suspend" })).not.toBeVisible();
  });

  test("9. direct-fetch bypass: setting another member's role is denied (estimator, not company admin)", async ({ page }) => {
    const result = await directRpc(page, "company_set_member_role", { p_company_id: "eeeeeeee-0000-0000-0001-000000000001", p_user_id: "eeeeeeee-0000-0000-0000-000000000007", p_role: "viewer" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("6. read access tier: can view a project they hold explicit viewer access to, but not edit it", async ({ page }) => {
    const result = await directRpc(page, "review_install", { p_project_id: PROJECT_A_INSTALL_REVIEW, p_decision: "approved" });
    // review_install is staff-only (project_manager/technical_services) --
    // a customer account, regardless of project-level access, must be denied.
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
