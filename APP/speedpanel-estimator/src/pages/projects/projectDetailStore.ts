// =============================================================================
// Single saved project -- detail view state + stage actions
// =============================================================================
// Separate from projectsStore.ts's list hook since the detail page needs live
// single-row state plus the stage-transition RPC calls (request/review
// install/technical), not just CRUD. Same {data,loading,error}+optimistic-
// patch shape as the rest of the app's Supabase-backed hooks, built on the
// shared useAsyncResource.ts.
// =============================================================================
import { useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { saveProjectSnapshot } from "./saveProjectSnapshot";
import { parseProjectRow, type ProjectRow, type SavedProjectData } from "./projectTypes";
import { useAsyncResource } from "./useAsyncResource";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "This project's data looks corrupted and can't be opened.";

// id is optional so QuoteRequestPage.tsx can call this unconditionally (React
// hooks can't be called conditionally) for its anonymous, project-less flow --
// an unset id just short-circuits to an idle, empty state, no fetch fired.
export function useProject(id: string | undefined) {
  const fetchProject = useCallback(async (): Promise<{ data: ProjectRow | null; error: string | null }> => {
    if (!id || !supabase) return { data: null, error: null };
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
    if (error) return { data: null, error: error.message };
    const parsed = parseProjectRow(data);
    return parsed ? { data: parsed, error: null } : { data: null, error: BAD_SHAPE };
  }, [id]);

  const { data: project, loading, error, reload: load, setData } = useAsyncResource(fetchProject, [id], {
    initialData: null as ProjectRow | null,
    skip: !id || !supabase,
    skipError: id && !supabase ? NOT_CONFIGURED : null,
  });

  const rename = async (name: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setData(prev => (prev ? { ...prev, name } : prev));
    return null;
  };

  const saveSnapshot = async (data: SavedProjectData): Promise<string | null> => {
    if (!id) return NOT_CONFIGURED;
    const { error: err } = await saveProjectSnapshot(id, data);
    if (err) return err;
    setData(prev => (prev ? { ...prev, data, updated_at: new Date().toISOString() } : prev));
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

  return { project, loading, error, reload: load, rename, saveSnapshot, deleteProject, requestInstallReview, requestTechnicalReview };
}
