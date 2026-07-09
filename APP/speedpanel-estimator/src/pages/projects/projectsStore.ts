// =============================================================================
// Saved projects -- the signed-in user's own list
// =============================================================================
// Same live-Supabase-fetch shape as admin/requests/requestsStore.ts's
// useAdminRequests -- load() does a full refetch, single-row mutations
// optimistically patch local state on success rather than refetching.
// Requires a signed-in user (see useAuth.ts); returns a stub state with no
// user, mirroring useAdminRequests' "not configured" stub for !supabase.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { saveProjectSnapshot } from "./saveProjectSnapshot";
import { ProjectRowSchema, type ProjectRow, type SavedProjectData } from "./projectTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const NOT_SIGNED_IN = "Sign in to see your projects.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface ProjectsState {
  projects: ProjectRow[];
  loading: boolean;
  error: string | null;
}

export function blankSnapshot(): SavedProjectData {
  return {
    v: 1, walls: [], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
    system: "int-vert", mode: "project", dimUnit: "m",
  };
}

export function useProjects(user: User | null) {
  const [state, setState] = useState<ProjectsState>(() =>
    !supabase ? { projects: [], loading: false, error: NOT_CONFIGURED }
    : !user ? { projects: [], loading: false, error: NOT_SIGNED_IN }
    : { projects: [], loading: true, error: null },
  );

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("projects").select("*")
      .eq("owner_id", user.id).is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) { setState({ projects: [], loading: false, error: error.message }); return; }
    const parsed = ProjectRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ projects: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ projects: parsed.data, loading: false, error: null });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createProject = async (name: string): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    if (!user) return { id: null, error: NOT_SIGNED_IN };
    const { data, error } = await supabase.from("projects")
      .insert({ owner_id: user.id, name, data: blankSnapshot() })
      .select("*").single();
    if (error) return { id: null, error: error.message };
    const parsed = ProjectRowSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: BAD_SHAPE };
    setState(s => ({ ...s, projects: [parsed.data, ...s.projects] }));
    return { id: parsed.data.id, error: null };
  };

  const renameProject = async (id: string, name: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, name } : p) }));
    return null;
  };

  const saveSnapshot = async (id: string, data: SavedProjectData): Promise<string | null> => {
    const err = await saveProjectSnapshot(id, data);
    if (err) return err;
    setState(s => ({ ...s, projects: s.projects.map(p => p.id === id ? { ...p, data, updated_at: new Date().toISOString() } : p) }));
    return null;
  };

  const deleteProject = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, projects: s.projects.filter(p => p.id !== id) }));
    return null;
  };

  return { ...state, reload: load, createProject, renameProject, saveSnapshot, deleteProject };
}
