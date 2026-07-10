// =============================================================================
// Single saved project -- detail view state + stage actions
// =============================================================================
// Separate from projectsStore.ts's list hook since the detail page needs live
// single-row state plus the stage-transition RPC calls (request/review
// install/technical), not just CRUD. Same {data,loading,error}+optimistic-
// patch shape as the rest of the app's Supabase-backed hooks.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { saveProjectSnapshot } from "./saveProjectSnapshot";
import { ProjectRowSchema, type ProjectRow, type SavedProjectData } from "./projectTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "This project's data looks corrupted and can't be opened.";

interface ProjectState {
  project: ProjectRow | null;
  loading: boolean;
  error: string | null;
}

// id is optional so QuoteRequestPage.tsx can call this unconditionally (React
// hooks can't be called conditionally) for its anonymous, project-less flow --
// an unset id just short-circuits to an idle, empty state, no fetch fired.
export function useProject(id: string | undefined) {
  const [state, setState] = useState<ProjectState>(() =>
    !id || !supabase ? { project: null, loading: false, error: id ? NOT_CONFIGURED : null } : { project: null, loading: true, error: null },
  );

  const load = useCallback(async () => {
    if (!id || !supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error) { setState({ project: null, loading: false, error: error.message }); return; }
    const parsed = ProjectRowSchema.safeParse(data);
    if (!parsed.success) { setState({ project: null, loading: false, error: BAD_SHAPE }); return; }
    setState({ project: parsed.data, loading: false, error: null });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const rename = async (name: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setState(s => (s.project ? { ...s, project: { ...s.project, name } } : s));
    return null;
  };

  const saveSnapshot = async (data: SavedProjectData): Promise<string | null> => {
    if (!id) return NOT_CONFIGURED;
    const err = await saveProjectSnapshot(id, data);
    if (err) return err;
    setState(s => (s.project ? { ...s, project: { ...s.project, data, updated_at: new Date().toISOString() } } : s));
    return null;
  };

  const deleteProject = async (): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    return error ? error.message : null;
  };

  const callRpc = async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await load();
    return null;
  };

  const requestInstallReview = () => callRpc("request_install_review", { p_project_id: id });
  const requestTechnicalReview = () => callRpc("request_technical_review", { p_project_id: id });

  return { ...state, reload: load, rename, saveSnapshot, deleteProject, requestInstallReview, requestTechnicalReview };
}
