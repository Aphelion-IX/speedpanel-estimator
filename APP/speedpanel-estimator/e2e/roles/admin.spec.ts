import { test, expect } from "@playwright/test";
import { signInAsAdmin, signOut } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";

// super_admin -- unrestricted per has_staff_role()'s own grandfather rule.
// See e2e/README.md's role matrix.
test.describe("admin (super_admin)", () => {
  test.beforeEach(async ({ page }) => { await signInAsAdmin(page); });

  test("1-2. can sign in and out", async ({ page }) => {
    await expect(page.getByTitle(/^Signed in as /)).toBeVisible();
    await signOut(page);
    await expect(page.getByTitle("Log in")).toBeVisible();
  });

  test("3. every admin dashboard section is reachable", async ({ page }) => {
    for (const sub of ["users", "companies", "permissions", "analytics", "auditLog", "products", "systems", "maths", "documents", "requests", "projectReviews", "orders", "manufacturing"]) {
      await page.goto(`/#/admin/${sub}`);
      await expect(page.getByText("Not part of your role")).not.toBeVisible();
    }
  });

  test("7. can call a super_admin-only RPC directly and it succeeds", async ({ page }) => {
    const result = await directRpc(page, "admin_list_companies");
    expect(result.status).toBe(200);
  });
});
