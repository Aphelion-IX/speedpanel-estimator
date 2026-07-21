// =============================================================================
// Company: invite a teammate into a company workspace
// =============================================================================
// Mirrors admin-invite-user/index.ts's two-client pattern exactly (see that
// file's own header comment for the full rationale) -- the only difference
// is the auth check calls is_company_admin(companyId) instead of is_admin(),
// and the caller's own company_id/role are never trusted from the request
// body, only derived server-side from the RPC check.
//
// Ordering matters here: the `invitations` row is inserted BEFORE
// inviteUserByEmail() is called, not after. For a brand-new email,
// inviteUserByEmail() creates the auth.users row synchronously, which fires
// handle_new_user() (see supabase/schema.sql) -- that trigger looks for a
// PENDING invitation matching the new email to auto-accept. If the
// invitations row didn't exist yet at that moment, the auto-accept would
// silently find nothing and the person would end up with an account but no
// company membership.
//
// If the email already has an account, inviteUserByEmail() errors (Supabase
// Auth won't re-invite an existing user) -- that's expected, not a failure:
// the invitations row stays 'pending', surfaced in-app via
// PendingInvitationsBanner.tsx + accept_company_invitation()/
// decline_company_invitation(), since this app has no way to email an
// existing user a notification.
//
// A second mode (`action: "resend"`) re-extends an existing pending
// invitation's expiry and, if that email still has no account, re-fires
// inviteUserByEmail() -- resend_company_invitation() (the RPC) does the
// metadata-only half; this function does the half that needs the
// service-role key.
//
// A third mode (`action: "fixEmail"`) is Phase 5's (Company Accounts &
// Pricing) retry path for a `delivery_failed` invitation: same split as
// resend -- admin_fix_invitation_email() (the RPC) resets email/status/
// failure_reason, then this function re-fires inviteUserByEmail() at the
// (possibly corrected) address.
//
// A real inviteUserByEmail() failure (not "already registered") on either
// the initial send or a resend/fixEmail retry now UPDATES the invitations
// row to `delivery_failed` + failure_reason instead of deleting it (Phase 5
// -- a failed send used to leave literally no record anywhere that it was
// ever attempted).
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_COMPANY_ROLES = ["owner", "admin", "project_manager", "estimator", "site_user", "viewer"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// True if this looks like Supabase Auth's "this email already has an
// account" error, distinguishing it from a real failure worth surfacing.
function isAlreadyRegistered(message: string | undefined): boolean {
  return /already|registered|exists/i.test(message ?? "");
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    action?: unknown; invitationId?: unknown;
    companyId?: unknown; email?: unknown; role?: unknown;
    name?: unknown; message?: unknown; projectIds?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not authorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  if (body.action === "resend") {
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    if (!invitationId) return json({ error: "Missing invitationId" }, 400);

    // resend_company_invitation() does the auth check (is_company_admin)
    // and the metadata reset -- reuse it here rather than duplicating the
    // check, then read back the row to know which email to re-invite.
    const { error: resendError } = await callerClient.rpc("resend_company_invitation", { p_invitation_id: invitationId });
    if (resendError) return json({ error: resendError.message }, 400);

    const { data: invitation } = await serviceClient.from("invitations").select("email").eq("id", invitationId).single();
    if (invitation?.email) {
      const { error: reinviteError } = await serviceClient.auth.admin.inviteUserByEmail(invitation.email);
      if (reinviteError && !isAlreadyRegistered(reinviteError.message)) {
        await serviceClient.from("invitations").update({ status: "delivery_failed", failure_reason: reinviteError.message }).eq("id", invitationId);
        return json({ error: reinviteError.message, deliveryFailed: true }, 400);
      }
    }
    return json({ ok: true });
  }

  if (body.action === "fixEmail") {
    const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
    const newEmail = typeof body.email === "string" ? body.email.trim() : "";
    if (!invitationId) return json({ error: "Missing invitationId" }, 400);
    if (!EMAIL_RE.test(newEmail)) return json({ error: "Enter a valid email address." }, 400);

    // admin_fix_invitation_email() does the auth check (is_company_admin),
    // requires the row to currently be delivery_failed, and resets
    // email/status/failure_reason/expiry -- same split as "resend" above.
    const { error: fixError } = await callerClient.rpc("admin_fix_invitation_email", { p_invitation_id: invitationId, p_new_email: newEmail });
    if (fixError) return json({ error: fixError.message }, 400);

    const { error: reinviteError } = await serviceClient.auth.admin.inviteUserByEmail(newEmail);
    if (reinviteError && !isAlreadyRegistered(reinviteError.message)) {
      await serviceClient.from("invitations").update({ status: "delivery_failed", failure_reason: reinviteError.message }).eq("id", invitationId);
      return json({ error: reinviteError.message, deliveryFailed: true }, 400);
    }
    return json({ ok: true });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : null;
  const projectIds = Array.isArray(body.projectIds) && body.projectIds.every(id => typeof id === "string") && body.projectIds.length > 0
    ? (body.projectIds as string[])
    : null;

  if (!companyId) return json({ error: "Missing companyId" }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (!VALID_COMPANY_ROLES.includes(role)) return json({ error: "Invalid role." }, 400);

  const { data: isCompanyAdmin, error: authError } = await callerClient.rpc("is_company_admin", { p_company_id: companyId });
  if (authError || !isCompanyAdmin) return json({ error: "Not authorized" }, 403);

  const { data: callerData } = await callerClient.auth.getUser();
  const callerId = callerData.user?.id ?? null;

  const { data: invitation, error: invitationError } = await serviceClient
    .from("invitations")
    .insert({
      company_id: companyId, email, invitee_name: name, role, invited_by: callerId,
      message, project_ids: projectIds,
    })
    .select("id")
    .single();
  if (invitationError || !invitation) return json({ error: invitationError?.message ?? "Could not create invitation." }, 400);

  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
  if (inviteError && !isAlreadyRegistered(inviteError.message)) {
    // A real failure (not "already registered") -- mark the row
    // delivery_failed instead of deleting it (Phase 5, Company Accounts &
    // Pricing), so it's visible on the standalone Invitations page and
    // fixable via admin_fix_invitation_email() rather than vanishing with
    // no trace that a send was ever attempted.
    await serviceClient.from("invitations").update({ status: "delivery_failed", failure_reason: inviteError.message }).eq("id", invitation.id);
    return json({ error: inviteError.message, invitationId: invitation.id, deliveryFailed: true }, 400);
  }

  return json({ id: invitation.id, existingAccount: Boolean(inviteError) });
});
