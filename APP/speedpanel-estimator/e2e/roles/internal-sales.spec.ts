import { test, expect } from "@playwright/test";
import { signInAsInternalSales } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";
import { ORDER_A_PROFORMA_ISSUED } from "../fixtures/seedIds";

// internal_sales staff -- SECTION_ROLES allows only "orders".
test.describe("internal-sales (staff)", () => {
  test.beforeEach(async ({ page }) => { await signInAsInternalSales(page); });

  test("3. Orders is reachable; Requests (bdm-only) is not", async ({ page }) => {
    await page.goto("/#/admin/orders");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    await page.goto("/#/admin/requests");
    await expect(page.getByText("Not part of your role")).toBeVisible();
  });

  test("4. Issue pro forma invoice action is visible on Orders", async ({ page }) => {
    await page.goto("/#/admin/orders");
    await expect(page.getByRole("button", { name: /Issue pro forma invoice/i }).first()).toBeVisible();
  });

  test("9. direct-fetch bypass: admin_update_manufacturing (dispatch-only) is denied", async ({ page }) => {
    const result = await directRpc(page, "admin_update_manufacturing", { p_order_id: ORDER_A_PROFORMA_ISSUED, p_panels_manufactured: 1, p_manufacturing_est_completion: null });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
