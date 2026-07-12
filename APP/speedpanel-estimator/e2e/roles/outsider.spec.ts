import { test, expect } from "@playwright/test";
import { signInAsOutsider } from "../fixtures/auth";
import { directTable } from "../fixtures/directApi";
import { COMPANY_A, PROJECT_A_DRAFT } from "../fixtures/seedIds";

// outsider@e2e.test -- Company B only. The dedicated cross-company-isolation
// persona: every check here targets Company A, which they have zero
// relationship to.
test.describe("outsider (Company B, no relation to Company A)", () => {
  test.beforeEach(async ({ page }) => { await signInAsOutsider(page); });

  test("8. cannot see Company A in the companies list at all", async ({ page }) => {
    const result = await directTable(page, "companies", `id=eq.${COMPANY_A}`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  test("8. cannot see Company A's projects", async ({ page }) => {
    const result = await directTable(page, "projects", `id=eq.${PROJECT_A_DRAFT}`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  test("8. cannot see Company A's staff assignments", async ({ page }) => {
    const result = await directTable(page, "staff_assignments", `company_id=eq.${COMPANY_A}`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });
});
