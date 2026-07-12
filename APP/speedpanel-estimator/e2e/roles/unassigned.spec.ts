import { test, expect } from "@playwright/test";
import { signInAsUnassigned } from "../fixtures/auth";
import { directRpc, directTable } from "../fixtures/directApi";

// unassigned@e2e.test -- authenticated, profiles.role='user',
// staff_role=null, no company membership at all. Genuinely no special
// access -- distinct from the internal "grandfather" case (a role='admin'
// account with staff_role=null gets FULL access, see
// supabase/tests/database/01_staff_role_and_admin.test.sql). Do not confuse
// the two in any future edit to this file.
test.describe("unassigned (authenticated, no role, no company)", () => {
  test.beforeEach(async ({ page }) => { await signInAsUnassigned(page); });

  test("3. DOCUMENTED FINDING: the Admin dashboard shell renders for this account (adminSectionAccess.ts's canAccessSection treats a null staffRole as \"always allowed\", not distinguishing internal-grandfather from external-no-role) -- but see the next test: the underlying data is still denied by RLS regardless", async ({ page }) => {
    await page.goto("/#/admin");
    await expect(page.getByText("Admin Dashboard")).toBeVisible();
  });

  test("2/9. RLS backstop: despite the UI shell being reachable, the actual admin RPC is denied", async ({ page }) => {
    const result = await directRpc(page, "admin_list_users", { p_limit: 10, p_offset: 0 });
    // admin_list_users (schema.sql) is a `select ... where
    // has_staff_role(array[])` function -- an unauthorized caller gets HTTP
    // 200 with an empty result set (the WHERE clause filters every row),
    // not an HTTP error. The security property under test is "no staff
    // roster data reaches a non-staff caller", not a specific status code.
    if (result.status === 200) {
      expect(JSON.parse(result.body)).toEqual([]);
    } else {
      expect(result.status).toBeGreaterThanOrEqual(400);
    }
  });

  test("5. sees zero companies and zero memberships anywhere", async ({ page }) => {
    const companies = await directTable(page, "companies");
    expect(JSON.parse(companies.body)).toEqual([]);
    const memberships = await directTable(page, "company_memberships");
    expect(JSON.parse(memberships.body)).toEqual([]);
  });
});
