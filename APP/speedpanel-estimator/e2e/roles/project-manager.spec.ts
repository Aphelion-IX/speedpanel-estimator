import { test, expect } from "@playwright/test";
import { signInAsProjectManager } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";
import { ORDER_A_PROFORMA_REQUESTED } from "../fixtures/seedIds";

// project_manager staff -- adminSectionAccess.ts's SECTION_ROLES allows only
// "projectReviews" (plus the always-open dashboard); everything else is
// blocked client-side, and RLS backstops it server-side regardless (see
// supabase/tests/database/04_security_definer_rpcs.test.sql).
test.describe("project-manager (staff)", () => {
  test.beforeEach(async ({ page }) => { await signInAsProjectManager(page); });

  test("3. Project Reviews is reachable; Orders (internal_sales-only) is not", async ({ page }) => {
    await page.goto("/#/admin/projectReviews");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    await page.goto("/#/admin/orders");
    await expect(page.getByText("Not part of your role")).toBeVisible();
  });

  test("4. Approve/Request-changes actions are visible on Project Reviews", async ({ page }) => {
    await page.goto("/#/admin/projectReviews");
    // Two sequential Supabase round trips gate this queue (staff_assignments
    // scope resolution, then the scoped projects fetch -- see
    // useMyQueueScope/adminProjectsStore.ts) -- give it more room than the
    // 5s default on a cold CI connection.
    await expect(page.getByRole("button", { name: /Approve install review/i })).toBeVisible({ timeout: 20_000 });
  });

  test("9. direct-fetch bypass: issue_proforma_invoice (internal_sales-only) is denied even though PM is valid staff", async ({ page }) => {
    const result = await directRpc(page, "issue_proforma_invoice", { p_order_id: ORDER_A_PROFORMA_REQUESTED, p_note: null });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("9. direct-fetch bypass: admin_list_companies (super_admin-only) is denied", async ({ page }) => {
    const result = await directRpc(page, "admin_list_companies");
    // admin_list_companies (schema.sql) is a `select ... where
    // has_staff_role(array[])` function, not a `raise exception` guard like
    // the write RPCs elsewhere in this file -- an unauthorized caller gets
    // HTTP 200 with an empty result set (the WHERE clause filters every
    // row), not an HTTP error. The security property under test is "no
    // company data reaches a non-super_admin caller", not a specific status
    // code.
    if (result.status === 200) {
      expect(JSON.parse(result.body)).toEqual([]);
    } else {
      expect(result.status).toBeGreaterThanOrEqual(400);
    }
  });
});
