import { test, expect } from "@playwright/test";
import { signInAsTechnical } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";

// technical_services staff -- SECTION_ROLES allows only "projectReviews"
// (shared with project_manager).
test.describe("technical (staff)", () => {
  test.beforeEach(async ({ page }) => { await signInAsTechnical(page); });

  test("3. Project Reviews is reachable; Companies (super_admin-only) is not", async ({ page }) => {
    await page.goto("/#/admin/projectReviews");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    await page.goto("/#/admin/companies");
    await expect(page.getByText("Not part of your role")).toBeVisible();
  });

  test("4. Approve technical review action is visible", async ({ page }) => {
    await page.goto("/#/admin/projectReviews");
    await expect(page.getByRole("button", { name: /Approve technical review/i })).toBeVisible();
  });

  test("9. direct-fetch bypass: admin_create_company (super_admin-only) is denied", async ({ page }) => {
    const result = await directRpc(page, "admin_create_company", { p_legal_name: "Should Fail Co" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
