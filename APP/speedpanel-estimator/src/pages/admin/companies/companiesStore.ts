// =============================================================================
// Admin Companies -- Speedpanel-managed company workspaces
// =============================================================================
// Speedpanel super_admins manage every company via the has_staff_role bypass
// added to is_company_admin/is_company_owner (see supabase/schema.sql's
// "Company-creation cutover"/"Internal staff roles") -- not the deferred
// SupportAccess grant model. That bypass is also what lets this file's
// roster/staff-team management reuse company/companyStore.ts's
// useCompanyMembers directly (CompanyUsersTab.tsx does) rather than a
// parallel read-only path: the same RPCs (company_set_member_role/
// company_remove_member/etc.) now work for an admin who was never added as
// a member of the company they're managing.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { unwrapInvokeError } from "../../../lib/edgeFunctionError";
import { StaffTeamMemberRowSchema, StaffCandidateRowSchema, type StaffTeamMemberRow, type StaffCandidateRow, type StaffRole } from "../../company/staffTypes";
import type { CompanyRole } from "../../company/companyTypes";
import { z } from "zod";

const NOT_CONFIGURED = "Companies aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const COMPANY_STATUSES = ["pending", "active", "on_hold", "suspended", "archived"] as const;
export type CompanyStatus = typeof COMPANY_STATUSES[number];

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  pending: "Pending", active: "Active", on_hold: "On Hold", suspended: "Suspended", archived: "Archived",
};

// Phase 2 (Company Accounts & Pricing): admin_list_companies() grew from a
// 4-column row to also carry every field CompaniesListPage.tsx's table and
// CompanyOverviewPage.tsx's detail cards need -- see that RPC's own comment
// in supabase/schema.sql for why one shared row shape beats a second
// per-company RPC here.
const AdminCompanyRowSchema = z.object({
  id: z.string(), name: z.string(), member_count: z.number(), created_at: z.string(),
  legal_name: z.string(), trading_name: z.string().nullable(), abn: z.string().nullable(),
  account_code: z.string().nullable(), billing_email: z.string().nullable(), phone: z.string().nullable(),
  address: z.string().nullable(), status: z.enum(COMPANY_STATUSES),
  payment_terms: z.string().nullable(), internal_notes: z.string().nullable(),
  price_list_id: z.string().nullable(), price_list_name: z.string().nullable(),
  primary_user_name: z.string().nullable(), primary_user_email: z.string().nullable(),
  internal_owner_name: z.string().nullable(),
  // Phase 11 (Company Accounts & Pricing): only ever populated while
  // status === 'on_hold' -- admin_set_company_status() clears all four the
  // moment status changes to anything else, so these never show a stale
  // hold's details.
  hold_reason: z.string().nullable(), hold_applied_by_name: z.string().nullable(),
  hold_placed_at: z.string().nullable(), hold_review_date: z.string().nullable(),
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
    paymentTerms?: string; internalNotes?: string;
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
      p_payment_terms: input.paymentTerms || null,
      p_internal_notes: input.internalNotes || null,
    });
    setSubmitting(false);
    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  };

  return { submitting, createCompany };
}

// admin_set_company_status() -- Phase 2's status editor, used by
// CompanyOverviewPage.tsx's status badge/action. holdReviewDate (Phase 11)
// only matters when status is 'on_hold' -- the RPC itself ignores/clears it
// for every other status, so passing it regardless of the target status is
// harmless.
export async function adminSetCompanyStatus(companyId: string, status: CompanyStatus, reason?: string, holdReviewDate?: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_set_company_status", {
    p_company_id: companyId, p_status: status, p_reason: reason || null, p_hold_review_date: holdReviewDate || null,
  });
  return error ? error.message : null;
}

const OnboardingProgressSchema = z.object({
  has_legal_details: z.boolean(), has_owner: z.boolean(), has_default_address: z.boolean(), has_pricing_setup: z.boolean(),
});
export type OnboardingProgress = z.infer<typeof OnboardingProgressSchema>;

// company_onboarding_progress() -- Phase 11's Pending Setup checklist, a
// computed function server-side (never a stored percentage) so it can't
// drift out of sync with the data it's checking.
export function useCompanyOnboardingProgress(companyId: string | null) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !companyId) { setLoading(false); setError(companyId ? NOT_CONFIGURED : null); return; }
    setLoading(true);
    supabase.rpc("company_onboarding_progress", { p_company_id: companyId }).then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      const row = Array.isArray(data) ? data[0] : data;
      const parsed = OnboardingProgressSchema.safeParse(row);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      setProgress(parsed.data);
      setLoading(false);
    });
  }, [companyId]);

  return { progress, loading, error };
}

const ActivityCountsSchema = z.object({ project_count: z.number(), order_count: z.number() });
export type CompanyActivityCounts = z.infer<typeof ActivityCountsSchema>;

// admin_company_activity_counts() -- CompanyOverviewPage.tsx's two extra
// KPI tiles (Open projects / Orders), kept separate from
// useAdminCompanies() since it's the only screen that needs them.
export function useCompanyActivityCounts(companyId: string | null) {
  const [counts, setCounts] = useState<CompanyActivityCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !companyId) { setLoading(false); setError(companyId ? NOT_CONFIGURED : null); return; }
    setLoading(true);
    supabase.rpc("admin_company_activity_counts", { p_company_id: companyId }).then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      const row = Array.isArray(data) ? data[0] : data;
      const parsed = ActivityCountsSchema.safeParse(row);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      setCounts(parsed.data);
      setLoading(false);
    });
  }, [companyId]);

  return { counts, loading, error };
}

// For a brand-new external/customer account -- unlike useCompanyMembers'
// addExistingMember (company/companyStore.ts, requires the account to
// already exist), this goes through the admin-invite-user Edge Function to
// create it, same as AdminUsersPage.tsx's staff card. Passing
// companyId/companyRole attaches them to that company in the same request
// (see supabase/functions/admin-invite-user/index.ts); password is
// optional -- present, the account is live immediately with that password
// (no email); absent, they get an invite email instead. role is always
// "user" here (never "admin"/staff) -- an external user, not a hire. Called
// from CreateCompanyUserForm.tsx, embedded on CompanyUsersTab.tsx.
export async function adminCreateCompanyUser(input: {
  companyId: string; email: string; role: CompanyRole; password?: string;
}): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.functions.invoke("admin-invite-user", {
    body: {
      email: input.email, role: "user", companyId: input.companyId, companyRole: input.role,
      ...(input.password ? { password: input.password } : {}),
    },
  });
  return error ? await unwrapInvokeError(error) : null;
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
