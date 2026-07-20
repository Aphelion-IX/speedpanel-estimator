import { test, expect } from "@playwright/test";
import { signInAsMember, signInAsUnassigned } from "./fixtures/auth";
import { directRpc, directRest } from "./fixtures/directApi";
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

  // Regression: panels/tracks/fixings/sealants/colours/admin_documents/
  // system_locked_rows/math_constants/system_tables used to have "Public
  // write access" RLS policies (using(true)/with_check(true)) -- ANY caller,
  // not just a signed-in non-admin, could write these tables directly. Now
  // gated to is_admin(). A signed-in member (Admin nav isn't even in their
  // UI) is the weakest useful probe -- a fully unauthenticated request would
  // fail the same way.
  test("member (no Admin nav access) can't insert directly into the panels catalog table", async ({ page }) => {
    await signInAsMember(page);
    const result = await directRest(page, "/panels", {
      method: "POST",
      body: {
        type: 999999, label: "E2E RLS PROBE -- should never persist",
        depth: "0mm", frl: "-/-/-", pack: 1,
        ctrack_stock: 1, ctrack_dim: "0x0x0", jtrack_dim: "0x0x0",
        max_h_vert: 1, max_h_horiz: 1,
        span_vert: {}, span_horiz: {}, corner_post: {}, horiz_ctrack: {},
      },
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
