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
import type { ProjectRow, SavedProjectData } from "./projectTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";

interface ProjectState {
  project: ProjectRow | null;
  loading: boolean;
  error: string | null;
}

export function useProject(id: string) {
  const [state, setState] = useState<ProjectState>(() =>
    !supabase ? { project: null, loading: false, error: NOT_CONFIGURED } : { project: null, loading: true, error: null },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    setState(
      error
        ? { project: null, loading: false, error: error.message }
        : { project: data as ProjectRow, loading: false, error: null },
    );
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
