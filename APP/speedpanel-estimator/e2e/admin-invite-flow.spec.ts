import { test, expect } from "@playwright/test";
import { signInAsAdmin, signInAs, signOut } from "./fixtures/auth";

// =============================================================================
// Covers the admin-invite-user Edge Function's "Set password directly" path
// (CreateStaffForm in AdminUsersPage.tsx / inviteUser() in
// admin/users/usersStore.ts) end to end through the real UI -- not a direct
// Edge Function call, so this also exercises the form itself and the
// resulting account actually being sign-in-capable, not just that the
// function returns 200.
//
// admin-invite-user is already deployed (version 5, ACTIVE) -- this test
// does not redeploy it, it only calls the already-live function via the
// normal UI flow, same as a real super_admin would.
//
// Uses a timestamp-suffixed email (never a fixed one) so reruns never
// collide with a previous run's account -- see the user's own instruction
// against fixed-email reruns. The password is generated fresh at test-run
// time, is never committed to git, and only ever controls this one
// disposable @e2e.test account (no company membership, no staff_assignments
// row, so it has no access to anything beyond its own session) -- distinct
// from E2E_PASSWORD, which gates the real seeded personas.
//
// Cleanup: this app has no delete-user mechanism in its UI or RPC surface
// (admin_list_users()/admin_set_staff_role() etc. can demote/relist but
// never delete an auth.users row, and doing so directly would require the
// service-role key, which CLAUDE.md forbids in frontend/test code). The
// created account is therefore left in place -- harmless disposable test
// data, distinguishable from every other seeded persona by its
// `invite-<timestamp>@e2e.test` address, for whoever administers the
// project to prune periodically alongside the rest of the @e2e.test rows.
// =============================================================================
test.describe("admin invite flow (admin-invite-user Edge Function, password path)", () => {
  test("super admin creates a new staff account and the new account can sign in", async ({ page }) => {
    const email = `invite-${Date.now()}@e2e.test`;
    const password = `Invite-${Date.now()}-Aa1!`;

    await signInAsAdmin(page);
    await page.goto("/#/admin/users");

    // CreateStaffForm renders first on the page, ahead of PromoteUserForm's
    // separate <form> -- disambiguates the two email/password inputs that
    // would otherwise both match `input[type=email]` on this page. Field
    // (shared/fields.tsx) has no htmlFor, so getByLabel() doesn't resolve --
    // same constraint as the sign-in form (see fixtures/auth.ts).
    const form = page.locator("form").first();
    await form.locator('input[type="email"]').fill(email);
    await form.locator('input[type="password"]').fill(password);
    await form.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(/Created -- their account is live now/i)).toBeVisible({ timeout: 15_000 });

    await signOut(page);
    await signInAs(page, email, password);
    await expect(page.getByTitle(new RegExp(`^Signed in as ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
  });
});
