import type { Page } from "@playwright/test";

// =============================================================================
// Sign-in helpers -- drive the REAL login form (SignInGate.tsx), never the
// service-role key or a mocked session. See e2e/README.md for the full
// persona table these env vars/emails correspond to.
// =============================================================================
// SignInGate.tsx's Field component (src/pages/shared/fields.tsx) renders a
// bare <label> with no htmlFor/id pairing, so getByLabel() doesn't resolve
// -- select inputs by `type` within the sign-in form instead. The form only
// renders once you're on the "projects" tab (#/projects) while signed out
// -- there is no separate /login route.
// =============================================================================

export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/#/projects");
  const form = page.locator("form").filter({ has: page.locator('input[type="email"]') });
  await form.locator('input[type="email"]').fill(email);
  await form.locator('input[type="password"]').fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
  // AuthStatus.tsx's header button title flips to "Signed in as {email} --
  // click to log out" once the session is established -- the most reliable
  // "we're actually signed in" signal, independent of which tab/page we land on.
  await page.getByTitle(/^Signed in as /).waitFor({ state: "visible", timeout: 15_000 });
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTitle(/^Signed in as /).click();
  await page.getByTitle("Log in").waitFor({ state: "visible", timeout: 10_000 });
}

const password = () => {
  const value = process.env.E2E_PASSWORD;
  if (!value) throw new Error("E2E_PASSWORD is not set -- see e2e/README.md / .env.test.example");
  return value;
};

const email = (envVar: string) => {
  const value = process.env[envVar];
  if (!value) throw new Error(`${envVar} is not set -- see e2e/README.md / .env.test.example`);
  return value;
};

export const signInAsAdmin = (page: Page) => signInAs(page, email("E2E_ADMIN_EMAIL"), password());
export const signInAsProjectManager = (page: Page) => signInAs(page, email("E2E_PROJECT_MANAGER_EMAIL"), password());
export const signInAsBdm = (page: Page) => signInAs(page, email("E2E_BDM_EMAIL"), password());
export const signInAsInternalSales = (page: Page) => signInAs(page, email("E2E_INTERNAL_SALES_EMAIL"), password());
export const signInAsDispatch = (page: Page) => signInAs(page, email("E2E_DISPATCH_EMAIL"), password());
export const signInAsTechnical = (page: Page) => signInAs(page, email("E2E_TECHNICAL_EMAIL"), password());
export const signInAsCompanyAdmin = (page: Page) => signInAs(page, email("E2E_COMPANY_ADMIN_EMAIL"), password());
export const signInAsMember = (page: Page) => signInAs(page, email("E2E_MEMBER_EMAIL"), password());
export const signInAsOutsider = (page: Page) => signInAs(page, email("E2E_OUTSIDER_EMAIL"), password());
export const signInAsUnassigned = (page: Page) => signInAs(page, email("E2E_UNASSIGNED_EMAIL"), password());
