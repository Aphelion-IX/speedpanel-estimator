import { test, expect } from "@playwright/test";
import { signInAsMember, signInAsUnassigned } from "./fixtures/auth";
import { directRpc } from "./fixtures/directApi";
import { COMPANY_A } from "./fixtures/seedIds";

// "Hidden button != security" (point 9 of the user's checklist), consolidated
// separately from the per-persona files: these specifically target actions
// the UI never renders a control for at all (not just a disabled/hidden
// button) -- proving RLS/RPC gating is the real boundary, not the absence of
// a button in the React tree.
test.describe("direct API bypass -- hidden UI is not the security boundary", () => {
  test("member (estimator, no 'add member' button anywhere in their UI) still can't call admin_add_company_member_by_email directly", async ({ page }) => {
    await signInAsMember(page);
    const result = await directRpc(page, "admin_add_company_member_by_email", { p_company_id: COMPANY_A, p_email: "should-fail@e2e.test", p_role: "viewer" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("unassigned (no admin nav access to speak of) still can't call admin_promote_user_to_staff_by_email directly", async ({ page }) => {
    await signInAsUnassigned(page);
    const result = await directRpc(page, "admin_promote_user_to_staff_by_email", { p_email: "unassigned@e2e.test", p_staff_role: "super_admin" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("unassigned can't self-escalate via admin_set_staff_assignment either", async ({ page }) => {
    await signInAsUnassigned(page);
    const result = await directRpc(page, "admin_set_staff_assignment", { p_company_id: COMPANY_A, p_staff_user_id: "eeeeeeee-0000-0000-0000-00000000000a", p_role: "bdm" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
