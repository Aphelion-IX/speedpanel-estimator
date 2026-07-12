import { test, expect } from "@playwright/test";
import { signInAsBdm } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";

// bdm staff -- SECTION_ROLES allows only "requests".
test.describe("bdm (staff)", () => {
  test.beforeEach(async ({ page }) => { await signInAsBdm(page); });

  test("3. Requests is reachable; Manufacturing (dispatch-only) is not", async ({ page }) => {
    await page.goto("/#/admin/requests");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    await page.goto("/#/admin/manufacturing");
    await expect(page.getByText("Not part of your role")).toBeVisible();
  });

  test("5. bdm's assigned company's request pipeline is visible by default (My companies scope)", async ({ page }) => {
    await page.goto("/#/admin/requests");
    // "My companies" also appears as a hidden <option> in the scope-toggle
    // <select> (SCOPE_OPTIONS in AdminRequestsPage.tsx) -- match the visible
    // section heading's "(N)" suffix specifically to avoid a strict-mode
    // violation across the two matches.
    await expect(page.getByText(/^My companies \(\d+\)$/)).toBeVisible();
  });

  test("9. direct-fetch bypass: admin_set_staff_role (super_admin-only) is denied", async ({ page }) => {
    const result = await directRpc(page, "admin_set_staff_role", { p_user_id: "eeeeeeee-0000-0000-0000-000000000005", p_staff_role: "bdm" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
