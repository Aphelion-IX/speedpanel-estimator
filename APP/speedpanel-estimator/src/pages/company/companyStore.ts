// =============================================================================
// Company workspaces -- team management stores
// =============================================================================
// Several small hooks, same {data,loading,error,reload,...actions} shape as
// every other store in this app: useCompanyMembers (roster + pending invites
// + every membership-management action), useMyPendingInvitations (the
// accept/decline side, for an existing user invited into a second company),
// useCompanyAuditLog (paginated, mirrors admin/auditLog/auditLogStore.ts),
// useCompanyStaffTeam (read-only "Your Speedpanel Team" data). Company
// creation itself has no store here anymore -- it's Speedpanel-admin-only,
// see admin/companies/adminCompaniesWizardStore.ts. inviteMember's
// error-unwrapping uses the shared unwrapInvokeError() helper (see
// lib/edgeFunctionError.ts) -- same FunctionsHttpError shape as every other
// Edge Function invoke() in this app.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { unwrapInvokeError } from "../../lib/edgeFunctionError";
import {
  CompanyMemberRowSchema, InvitationRowSchema, AuditLogRowSchema,
  type CompanyMemberRow, type InvitationRow, type AuditLogRow, type CompanyRole, type MembershipStatus,
} from "./companyTypes";
import { StaffTeamMemberRowSchema, type StaffTeamMemberRow } from "./staffTypes";

const NOT_CONFIGURED = "Company workspaces aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PAGE_SIZE = 50;

interface CompanyMembersState {
  members: CompanyMemberRow[];
  invitations: InvitationRow[];
  loading: boolean;
  error: string | null;
}

export function useCompanyMembers(companyId: string | null) {
  const [state, setState] = useState<CompanyMembersState>({ members: [], invitations: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setState({ members: [], invitations: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const [membersResult, invitationsResult] = await Promise.all([
      supabase.rpc("company_list_members", { p_company_id: companyId }),
      supabase.from("invitations").select("*").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    if (membersResult.error) { setState({ members: [], invitations: [], loading: false, error: membersResult.error.message }); return; }
    if (invitationsResult.error) { setState({ members: [], invitations: [], loading: false, error: invitationsResult.error.message }); return; }
    const parsedMembers = CompanyMemberRowSchema.array().safeParse(membersResult.data ?? []);
    const parsedInvitations = InvitationRowSchema.array().safeParse(invitationsResult.data ?? []);
    if (!parsedMembers.success || !parsedInvitations.success) { setState({ members: [], invitations: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ members: parsedMembers.data, invitations: parsedInvitations.data, loading: false, error: null });
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const inviteMember = async (input: {
    email: string; role: CompanyRole; name?: string; message?: string; projectIds?: string[];
  }): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.functions.invoke("company-invite-member", {
      body: { companyId, email: input.email, role: input.role, name: input.name, message: input.message, projectIds: input.projectIds },
    });
    if (error) return unwrapInvokeError(error);
    await load();
    return null;
  };

  // Admin-only shortcut (see AdminCompaniesPage.tsx's canDirectAdd) for an
  // account that already exists (e.g. created directly in Supabase) --
  // bypasses the invite/accept flow entirely via admin_add_company_member_by_email,
  // which is has_staff_role(array[])-gated (super_admin) server-side, same
  // defense-in-depth as every other admin RPC. Errors if no account exists
  // yet for that email; the caller should fall back to inviteMember above.
  const addExistingMember = async (input: { email: string; role: CompanyRole }): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_add_company_member_by_email", {
      p_company_id: companyId, p_email: input.email, p_role: input.role,
    });
    if (error) return error.message;
    await load();
    return null;
  };

  const resendInvitation = async (invitationId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.functions.invoke("company-invite-member", { body: { action: "resend", invitationId } });
    if (error) return error.message;
    await load();
    return null;
  };

  const cancelInvitation = async (invitationId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("cancel_company_invitation", { p_invitation_id: invitationId });
    if (error) return error.message;
    setState(s => ({ ...s, invitations: s.invitations.filter(i => i.id !== invitationId) }));
    return null;
  };

  const setRole = async (userId: string, role: CompanyRole): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("company_set_member_role", { p_company_id: companyId, p_user_id: userId, p_role: role });
    if (error) return error.message;
    setState(s => ({ ...s, members: s.members.map(m => m.user_id === userId ? { ...m, role } : m) }));
    return null;
  };

  const setStatus = async (userId: string, status: Extract<MembershipStatus, "active" | "suspended">): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("company_set_member_status", { p_company_id: companyId, p_user_id: userId, p_status: status });
    if (error) return error.message;
    setState(s => ({ ...s, members: s.members.map(m => m.user_id === userId ? { ...m, status } : m) }));
    return null;
  };

  const removeMember = async (userId: string): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("company_remove_member", { p_company_id: companyId, p_user_id: userId });
    if (error) return error.message;
    setState(s => ({ ...s, members: s.members.filter(m => m.user_id !== userId) }));
    return null;
  };

  const removalWarnings = async (userId: string): Promise<{ activeProjectsAsPm: number; draftOrders: number; openReviewsAsPm: number } | null> => {
    if (!supabase || !companyId) return null;
    const { data, error } = await supabase.rpc("company_member_removal_warnings", { p_company_id: companyId, p_user_id: userId });
    if (error || !data || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0] as { active_projects_as_pm: number; draft_orders: number; open_reviews_as_pm: number };
    return { activeProjectsAsPm: row.active_projects_as_pm, draftOrders: row.draft_orders, openReviewsAsPm: row.open_reviews_as_pm };
  };

  return { ...state, reload: load, inviteMember, addExistingMember, resendInvitation, cancelInvitation, setRole, setStatus, removeMember, removalWarnings };
}

interface MyInvitationsState { invitations: InvitationRow[]; loading: boolean; error: string | null; }

// The accept/decline side, for an existing user invited into a SECOND
// company -- see supabase/schema.sql's invitations RLS policy ("a user reads
// invitations matching their own email"). A brand-new person never sees
// this: handle_new_user() auto-accepts their invite before they ever sign in.
export function useMyPendingInvitations(userEmail: string | null | undefined) {
  const [state, setState] = useState<MyInvitationsState>({ invitations: [], loading: false, error: null });

  const load = useCallback(async () => {
    if (!supabase || !userEmail) { setState({ invitations: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("invitations").select("*").eq("email", userEmail).eq("status", "pending");
    if (error) { setState({ invitations: [], loading: false, error: error.message }); return; }
    const parsed = InvitationRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ invitations: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ invitations: parsed.data, loading: false, error: null });
  }, [userEmail]);

  useEffect(() => { load(); }, [load]);

  const accept = async (invitationId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("accept_company_invitation", { p_invitation_id: invitationId });
    if (error) return error.message;
    setState(s => ({ ...s, invitations: s.invitations.filter(i => i.id !== invitationId) }));
    return null;
  };

  const decline = async (invitationId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("decline_company_invitation", { p_invitation_id: invitationId });
    if (error) return error.message;
    setState(s => ({ ...s, invitations: s.invitations.filter(i => i.id !== invitationId) }));
    return null;
  };

  return { ...state, reload: load, accept, decline };
}

interface AuditLogState { events: AuditLogRow[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; }

export function useCompanyAuditLog(companyId: string | null) {
  const [state, setState] = useState<AuditLogState>({ events: [], loading: true, loadingMore: false, error: null, hasMore: false });

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setState({ events: [], loading: false, loadingMore: false, error: null, hasMore: false }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("company_list_audit_log", { p_company_id: companyId, p_limit: PAGE_SIZE, p_offset: 0 });
    if (error) { setState({ events: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AuditLogRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ events: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ events: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase || !companyId) return;
    setState(s => ({ ...s, loadingMore: true }));
    const { data, error } = await supabase.rpc("company_list_audit_log", { p_company_id: companyId, p_limit: PAGE_SIZE, p_offset: state.events.length });
    if (error) { setState(s => ({ ...s, loadingMore: false, error: error.message })); return; }
    const parsed = AuditLogRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState(s => ({ ...s, loadingMore: false, error: BAD_SHAPE })); return; }
    setState(s => ({ ...s, events: [...s.events, ...parsed.data], loadingMore: false, hasMore: parsed.data.length === PAGE_SIZE }));
  };

  return { ...state, reload: load, loadMore };
}

// Read-only -- "Your Speedpanel Team" (company_list_staff_team() is readable
// by any active member, is_admin() bypass included server-side). No mutating
// actions here on purpose: the customer never edits this, see
// StaffTeamAssignmentPanel.tsx (admin/companies) for the write side.
export function useCompanyStaffTeam(companyId: string | null) {
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
    if (!parsed.success) { setError("Unexpected data shape from the server."); setLoading(false); return; }
    setStaff(parsed.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { staff, loading, error, reload: load };
}

// Just id+name -- backs the invite panel's "selected projects only" picker
// and ProjectMembersCard.tsx's "add teammate" picker. RLS already scopes
// this to projects the caller can see, same as any other projects query.
export function useCompanyProjects(companyId: string | null) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!supabase || !companyId) { setProjects([]); return; }
    let cancelled = false;
    supabase.from("projects").select("id, name").eq("company_id", companyId).is("deleted_at", null).order("name").then(({ data }) => {
      if (!cancelled) setProjects(data ?? []);
    });
    return () => { cancelled = true; };
  }, [companyId]);

  return projects;
}
