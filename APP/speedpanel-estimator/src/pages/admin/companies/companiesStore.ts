// =============================================================================
// Admin Companies -- Speedpanel-managed company workspaces
// =============================================================================
// Speedpanel super_admins manage every company via the has_staff_role bypass
// added to is_company_admin/is_company_owner (see supabase/schema.sql's
// "Company-creation cutover"/"Internal staff roles") -- not the deferred
// SupportAccess grant model. That bypass is also what lets this file's
// roster/staff-team management reuse company/companyStore.ts's
// useCompanyMembers directly (AdminCompaniesPage.tsx does) rather than a
// parallel read-only path: the same RPCs (company_set_member_role/
// company_remove_member/etc.) now work for an admin who was never added as
// a member of the company they're managing.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { StaffTeamMemberRowSchema, StaffCandidateRowSchema, type StaffTeamMemberRow, type StaffCandidateRow, type StaffRole } from "../../company/staffTypes";
import type { CompanyRole } from "../../company/companyTypes";
import { z } from "zod";

const NOT_CONFIGURED = "Companies aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const AdminCompanyRowSchema = z.object({
  id: z.string(), name: z.string(), member_count: z.number(), created_at: z.string(),
});
export type AdminCompanyRow = z.infer<typeof AdminCompanyRowSchema>;

interface CompaniesState { companies: AdminCompanyRow[]; loading: boolean; error: string | null; }

export function useAdminCompanies() {
  const [state, setState] = useState<CompaniesState>(() =>
    supabase ? { companies: [], loading: true, error: null } : { companies: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_companies");
    if (error) { setState({ companies: [], loading: false, error: error.message }); return; }
    const parsed = AdminCompanyRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ companies: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ companies: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}

// One-shot wrapper around admin_create_company -- the only way a company
// gets created now (see supabase/schema.sql's "Company-creation cutover").
export function useAdminCreateCompany() {
  const [submitting, setSubmitting] = useState(false);

  const createCompany = async (input: {
    legalName: string; tradingName?: string; abn?: string; customerAccountNumber?: string;
    billingEmail?: string; phone?: string; address?: string;
  }): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_create_company", {
      p_legal_name: input.legalName,
      p_trading_name: input.tradingName || null,
      p_abn: input.abn || null,
      p_customer_account_number: input.customerAccountNumber || null,
      p_billing_email: input.billingEmail || null,
      p_phone: input.phone || null,
      p_address: input.address || null,
    });
    setSubmitting(false);
    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  };

  return { submitting, createCompany };
}

// One-shot wrapper around admin_add_company_member_by_email, for the
// AdminPermissionsPage.tsx company picker -- unlike useCompanyMembers'
// addExistingMember (bound to one companyId for the lifetime of that hook
// instance), this takes companyId per call, since the caller here picks a
// different company each time via a select field rather than already being
// scoped to one company's own Members panel.
export async function adminGrantCompanyAccess(input: { companyId: string; email: string; role: CompanyRole }): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_add_company_member_by_email", {
    p_company_id: input.companyId, p_email: input.email, p_role: input.role,
  });
  return error ? error.message : null;
}

// Loaded once -- the picker source for assigning staff to a company (wizard
// step 3 and the per-company Speedpanel Team editor).
export function useAdminStaffCandidates() {
  const [candidates, setCandidates] = useState<StaffCandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    supabase.rpc("admin_list_staff_candidates").then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      const parsed = StaffCandidateRowSchema.array().safeParse(data ?? []);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      setCandidates(parsed.data);
      setLoading(false);
    });
  }, []);

  return { candidates, loading, error };
}

// The Speedpanel Team editor's data + write actions for one company --
// admin_set_staff_assignment/admin_remove_staff_assignment, both
// has_staff_role(array[])-gated (super_admin) server-side (see
// supabase/schema.sql).
export function useStaffAssignments(companyId: string | null) {
  const [staff, setStaff] = useState<StaffTeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setStaff([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("company_list_staff_team", { p_company_id: companyId });
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = StaffTeamMemberRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setStaff(parsed.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const setAssignment = async (staffUserId: string, role: StaffRole): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error: err } = await supabase.rpc("admin_set_staff_assignment", { p_company_id: companyId, p_staff_user_id: staffUserId, p_role: role });
    if (err) return err.message;
    await load();
    return null;
  };

  const removeAssignment = async (staffUserId: string, role: StaffRole): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error: err } = await supabase.rpc("admin_remove_staff_assignment", { p_company_id: companyId, p_staff_user_id: staffUserId, p_role: role });
    if (err) return err.message;
    setStaff(s => s.filter(m => !(m.staff_user_id === staffUserId && m.role === role)));
    return null;
  };

  return { staff, loading, error, reload: load, setAssignment, removeAssignment };
}
