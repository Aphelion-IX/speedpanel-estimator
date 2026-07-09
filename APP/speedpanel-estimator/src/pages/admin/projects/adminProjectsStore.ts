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
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { ProjectRowSchema, type ProjectRow } from "../../projects/projectTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface AdminProjectsState {
  projects: ProjectRow[];
  loading: boolean;
  error: string | null;
}

export function useAdminProjects() {
  const [state, setState] = useState<AdminProjectsState>(() =>
    supabase
      ? { projects: [], loading: true, error: null }
      : { projects: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*")
      .in("stage", ["install_review", "technical_review"])
      .order("updated_at", { ascending: true });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = ProjectRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed.data, loading: false, error: null });
  }, []);

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

  return { ...state, reload: load, approveInstallReview, requestInstallChanges, approveTechnicalReview, requestTechnicalChanges };
}
