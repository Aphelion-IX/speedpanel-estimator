// =============================================================================
// Company Accounts & Pricing -- standalone Invitations page (Phase 5)
// =============================================================================
// Cross-company read via admin_list_invitations() (has_permission('invitations.list')
// -gated) -- every other invitation RPC in supabase/schema.sql is scoped to
// one company (reached from that company's own Users tab); this is the
// first cross-company one. Resend/cancel/fixEmail reuse the exact same
// company-invite-member Edge Function + RPCs company/companyStore.ts's
// useCompanyMembers already calls (not duplicated, just called from here
// too) -- see that file's resendInvitation/cancelInvitation for the
// original per-company version of these same actions.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { unwrapInvokeError } from "../../../lib/edgeFunctionError";
import { COMPANY_ROLES } from "../../company/companyTypes";

const NOT_CONFIGURED = "Invitations aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "cancelled", "delivery_failed"] as const;
export type InvitationStatus = typeof INVITATION_STATUSES[number];

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: "Pending", accepted: "Accepted", expired: "Expired", cancelled: "Cancelled", delivery_failed: "Delivery Failed",
};

const AdminInvitationRowSchema = z.object({
  id: z.string(), company_id: z.string(), company_name: z.string(),
  email: z.string(), invitee_name: z.string().nullable(),
  role: z.enum(COMPANY_ROLES), status: z.enum(INVITATION_STATUSES), failure_reason: z.string().nullable(),
  created_at: z.string(), expires_at: z.string(), accepted_at: z.string().nullable(),
});
export type AdminInvitationRow = z.infer<typeof AdminInvitationRowSchema>;

export function useAdminInvitations() {
  const [invitations, setInvitations] = useState<AdminInvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_list_invitations", { p_company_id: null, p_status: null });
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = AdminInvitationRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setInvitations(parsed.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { invitations, loading, error, reload: load };
}

export async function adminResendInvitation(invitationId: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.functions.invoke("company-invite-member", { body: { action: "resend", invitationId } });
  return error ? await unwrapInvokeError(error) : null;
}

export async function adminCancelInvitation(invitationId: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("cancel_company_invitation", { p_invitation_id: invitationId });
  return error ? error.message : null;
}

// Resend-with-same-email and "edit then resend" both go through this one
// action -- the caller just passes the current email back unchanged for a
// plain retry, or an edited one to actually fix it.
export async function adminFixInvitationEmail(invitationId: string, email: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.functions.invoke("company-invite-member", { body: { action: "fixEmail", invitationId, email } });
  return error ? await unwrapInvokeError(error) : null;
}
