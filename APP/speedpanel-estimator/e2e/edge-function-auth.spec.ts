import { test, expect } from "@playwright/test";
import { signInAsDispatch, signInAsCompanyAdmin, signInAsUnassigned } from "./fixtures/auth";
import { directEdgeFunction } from "./fixtures/directApi";
import { COMPANY_A } from "./fixtures/seedIds";

// Edge Function authorization (point 10 of the user's checklist) --
// admin-invite-user/company-invite-member both re-check has_staff_role()/
// is_company_admin() themselves server-side (see
// supabase/functions/*/index.ts), independent of RLS. Denial-only checks
// here deliberately -- a "should succeed" case would create a real,
// persistent account with no transactional rollback available over HTTP
// (unlike the SQL-level tests), so success paths are exercised via the
// per-persona specs' own signed-in UI flows instead, not duplicated here.
test.describe("Edge Function authorization", () => {
  test("admin-invite-user denies a non-super_admin staff account", async ({ page }) => {
    await signInAsDispatch(page);
    const result = await directEdgeFunction(page, "admin-invite-user", { email: "should-fail@e2e.test", role: "admin", staffRole: "dispatch" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("admin-invite-user denies an external company admin", async ({ page }) => {
    await signInAsCompanyAdmin(page);
    const result = await directEdgeFunction(page, "admin-invite-user", { email: "should-fail@e2e.test", role: "user", companyId: COMPANY_A, companyRole: "viewer" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("admin-invite-user denies an unauthenticated-equivalent unassigned account", async ({ page }) => {
    await signInAsUnassigned(page);
    const result = await directEdgeFunction(page, "admin-invite-user", { email: "should-fail@e2e.test", role: "user" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  test("company-invite-member denies a company admin acting on a DIFFERENT company", async ({ page }) => {
    await signInAsCompanyAdmin(page);
    // company-admin only administers Company A -- company-invite-member is
    // is_company_admin(companyId)-gated per-call, so passing Company B's id
    // must still be denied even though the caller IS a valid company admin
    // somewhere.
    const result = await directEdgeFunction(page, "company-invite-member", { companyId: "eeeeeeee-0000-0000-0001-000000000002", email: "should-fail@e2e.test", role: "viewer" });
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});
