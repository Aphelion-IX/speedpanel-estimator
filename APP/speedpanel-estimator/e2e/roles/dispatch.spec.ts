import { test, expect } from "@playwright/test";
import { signInAsDispatch } from "../fixtures/auth";
import { directRpc } from "../fixtures/directApi";
import { ORDER_A_PROFORMA_REQUESTED } from "../fixtures/seedIds";

// dispatch staff -- SECTION_ROLES allows only "manufacturing".
test.describe("dispatch (staff)", () => {
  test.beforeEach(async ({ page }) => { await signInAsDispatch(page); });

  test("3. Manufacturing & Delivery is reachable; Users (super_admin-only) is not", async ({ page }) => {
    await page.goto("/#/admin/manufacturing");
    await expect(page.getByText("Not part of your role")).not.toBeVisible();

    await page.goto("/#/admin/users");
    await expect(page.getByText("Not part of your role")).toBeVisible();
  });

  test("4. Panels-manufactured field is editable on Manufacturing & Delivery", async ({ page }) => {
    await page.goto("/#/admin/manufacturing");
    await expect(page.getByLabel(/Panels manufactured/i).first()).toBeEditable();
  });

  test("9. direct-fetch bypass: issue_proforma_invoice (internal_sales-only) is denied", async ({ page }) => {
    const result = await directRpc(page, "issue_proforma_invoice", { p_order_id: ORDER_A_PROFORMA_REQUESTED, p_note: null });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
