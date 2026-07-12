import { test, expect } from "@playwright/test";
import { signInAsCompanyAdmin, signInAsOutsider } from "./fixtures/auth";
import { directTable } from "./fixtures/directApi";
import { COMPANY_A, COMPANY_B, PROJECT_A_INSTALL_REVIEW, PROJECT_B_DRAFT } from "./fixtures/seedIds";

// Bidirectional cross-company isolation, consolidated in one place (point 8
// of the user's checklist) -- Company A's admin can never see Company B's
// rows, and vice versa, across every company-scoped table. Per-persona spec
// files also touch this from their own angle; this file is the single
// authoritative sweep across tables not otherwise covered (invitations,
// audit_logs, project_documents).
test.describe("cross-company isolation", () => {
  test("Company A admin sees zero Company B rows across every company-scoped table", async ({ page }) => {
    await signInAsCompanyAdmin(page);
    for (const [table, query] of [
      ["companies", `id=eq.${COMPANY_B}`],
      ["company_memberships", `company_id=eq.${COMPANY_B}`],
      ["staff_assignments", `company_id=eq.${COMPANY_B}`],
      ["invitations", `company_id=eq.${COMPANY_B}`],
      ["audit_logs", `company_id=eq.${COMPANY_B}`],
      ["projects", `id=eq.${PROJECT_B_DRAFT}`],
    ] as const) {
      const result = await directTable(page, table, query);
      expect(result.status, `${table} status`).toBe(200);
      expect(JSON.parse(result.body), `${table} rows visible to Company A admin querying Company B`).toEqual([]);
    }
  });

  test("Company B's outsider sees zero Company A rows across every company-scoped table", async ({ page }) => {
    await signInAsOutsider(page);
    for (const [table, query] of [
      ["companies", `id=eq.${COMPANY_A}`],
      ["company_memberships", `company_id=eq.${COMPANY_A}`],
      ["staff_assignments", `company_id=eq.${COMPANY_A}`],
      ["invitations", `company_id=eq.${COMPANY_A}`],
      ["audit_logs", `company_id=eq.${COMPANY_A}`],
      ["projects", `id=eq.${PROJECT_A_INSTALL_REVIEW}`],
      ["project_documents", `project_id=eq.${PROJECT_A_INSTALL_REVIEW}`],
    ] as const) {
      const result = await directTable(page, table, query);
      expect(result.status, `${table} status`).toBe(200);
      expect(JSON.parse(result.body), `${table} rows visible to outsider querying Company A`).toEqual([]);
    }
  });
});
