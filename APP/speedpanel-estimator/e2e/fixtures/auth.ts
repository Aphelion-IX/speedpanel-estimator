import type { Page } from "@playwright/test";

// =============================================================================
// Sign-in helpers -- drive the REAL login form (LandingPage.tsx, the
// signed-out "mySPEEDPORTAL" front door), never the service-role key or a
// mocked session. See e2e/README.md for the full persona table these env
// vars/emails correspond to.
// =============================================================================
// The signed-out app is the full-screen LandingPage (App.tsx early-returns it
// before the TopNav/shell), so any signed-out route -- e.g. #/projects --
// lands on the same login form. Its submit button is labelled "Log in"; the
// email/password inputs are the only ones on the page, so select them by
// `type` within that form. Signed-in state is detected via AuthStatus.tsx's
// header button, whose title is `Signed in as {email}` -- the most reliable
// "we're actually signed in" signal, independent of which tab/page we land on.
// =============================================================================

export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/#/projects");
  const form = page.locator("form").filter({ has: page.locator('input[type="email"]') });
  await form.locator('input[type="email"]').fill(email);
  await form.locator('input[type="password"]').fill(password);
  await form.getByRole("button", { name: "Log in" }).click();
  await page.getByTitle(/^Signed in as /).waitFor({ state: "visible", timeout: 15_000 });
}

export async function signOut(page: Page): Promise<void> {
  // The signed-in avatar (title "Signed in as ...") only opens a dropdown;
  // the actual sign-out is a "Sign out" item inside it (AuthStatus.tsx). Once
  // signed out the app returns to the LandingPage, whose "Log in to
  // mySPEEDPORTAL" heading is the signed-out signal.
  await page.getByTitle(/^Signed in as /).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Log in to mySPEEDPORTAL" }).waitFor({ state: "visible", timeout: 10_000 });
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
