import { test, expect } from "@playwright/test";
import { signInAsCompanyAdmin } from "../fixtures/auth";
import { directRpc, directTable, directEdgeFunction } from "../fixtures/directApi";
import { COMPANY_B } from "../fixtures/seedIds";

// company-admin@e2e.test -- Company A owner. External account, not staff
// (profiles.role stays 'user'); manages their own company's Team page.
test.describe("company-admin (Company A owner)", () => {
  test.beforeEach(async ({ page }) => { await signInAsCompanyAdmin(page); });

  test("5-6. can read own company's Team page and see the invite/member-management controls", async ({ page }) => {
    await page.goto("/#/company/team");
    await expect(page.getByText("Invite a teammate")).toBeVisible();
  });

  test("8. cross-company: direct fetch of Company B's memberships returns nothing", async ({ page }) => {
    const result = await directTable(page, "company_memberships", `company_id=eq.${COMPANY_B}`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  test("9. direct-fetch bypass: acting on Company B via company_set_member_role is denied", async ({ page }) => {
    const result = await directRpc(page, "company_set_member_role", { p_company_id: COMPANY_B, p_user_id: "eeeeeeee-0000-0000-0000-000000000009", p_role: "viewer" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("10. Edge Function auth: admin-invite-user (super_admin-only) is denied for a company admin", async ({ page }) => {
    const result = await directEdgeFunction(page, "admin-invite-user", { email: "should-fail@e2e.test", role: "admin" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
