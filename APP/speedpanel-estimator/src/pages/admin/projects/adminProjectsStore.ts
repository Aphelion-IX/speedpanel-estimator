// =============================================================================
// Admin project review queue -- live Supabase fetch
// =============================================================================
// Same live-fetch shape as admin/requests/requestsStore.ts's useAdminRequests,
// but the query itself is narrower: only projects currently AWAITING a review
// action (stage in install_review/technical_review), not a full project
// browser. EVERY review decision here moves a project's stage to either
// 'draft' (approving install, or requesting changes on either review -- see
// supabase/schema.sql's review_install/review_technical) or 'approved'
// (approving technical review) -- none of which are in this queue's filter,
// so every successful action removes the row locally rather than patching it
// in place, unlike useAdminRequests' rows, which never leave view. A project
// reappears here only once the customer explicitly requests the next review.
//
// Scoped to the caller's assigned companies via useMyQueueScope/
// applyQueueScope (see shared/useMyQueueScope.ts) -- always applied for a
// non-super_admin role, no toggle: this is a decision queue, so anyone
// needing cross-company visibility should be super_admin instead.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { parseProjectRows, type ProjectRow } from "../../projects/projectTypes";
import { useMyQueueScope, applyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface AdminProjectsState {
  projects: ProjectRow[];
  loading: boolean;
  error: string | null;
}

export function useAdminProjects(userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean) {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [state, setState] = useState<AdminProjectsState>(() =>
    supabase
      ? { projects: [], loading: true, error: null }
      : { projects: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ projects: [], loading: false, error: scopeError }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await applyQueueScope(
      supabase.from("projects").select("*").in("stage", ["install_review", "technical_review"]), scope,
    ).order("updated_at", { ascending: true });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = parseProjectRows(data ?? []);
    if (!parsed) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed, loading: false, error: null });
  }, [scopeLoading, scopeError, scope.kind === "companies" ? scope.companyIds.join(",") : "all"]);

  useEffect(() => { load(); }, [load]);

  const runReview = async (fn: string, args: Record<string, unknown>, id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    setState(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) }));
    return null;
  };

  const approveInstallReview = (id: string) =>
    runReview("review_install", { p_project_id: id, p_decision: "approved" }, id);

  const requestInstallChanges = (id: string, note: string) =>
    runReview("review_install", { p_project_id: id, p_decision: "changes_requested", p_note: note }, id);

  const approveTechnicalReview = (id: string) =>
    runReview("review_technical", { p_project_id: id, p_decision: "approved" }, id);

  const requestTechnicalChanges = (id: string, note: string) =>
    runReview("review_technical", { p_project_id: id, p_decision: "changes_requested", p_note: note }, id);

  return { ...state, scope, reload: load, approveInstallReview, requestInstallChanges, approveTechnicalReview, requestTechnicalChanges };
}

interface MyPmProjectsState { projects: ProjectRow[]; loading: boolean; error: string | null; }

// "My active projects" section, for a project_manager viewer only -- every
// non-approved project for the companies where the caller is the assigned
// PM (a fuller list than the review queue above, since a PM cares about the
// whole pipeline, not just what's awaiting a decision). Relocated from
// myAssignments/myAssignmentsStore.ts unchanged.
export function useMyPmProjects(companyIds: string[]) {
  const [state, setState] = useState<MyPmProjectsState>({ projects: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || companyIds.length === 0) { setState({ projects: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*")
      .in("company_id", companyIds).order("updated_at", { ascending: false });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = parseProjectRows(data ?? []);
    if (!parsed) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed, loading: false, error: null });
  }, [companyIds.join(",")]);

  useEffect(() => { load(); }, [load]);

  return state;
}
