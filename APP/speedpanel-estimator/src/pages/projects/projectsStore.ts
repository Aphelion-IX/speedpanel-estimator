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
import { defaultWall } from "../../wallStore";
import { SYSTEMS } from "../../appShell/systems";
import type { WallSystemId } from "../../App";
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

// One default wall, not an empty list -- useWallStore's own initial state and
// resetWalls() never allow zero walls either (see wallStore.ts's
// defaultWall(1)/[defaultWall(1)]), because `active` (walls.find(...) ||
// walls[0]) has nothing to fall back to otherwise, and App.tsx reads
// active.orient unconditionally the moment a project's snapshot is loaded
// into the Estimator.
export function blankSnapshot(): SavedProjectData {
  return {
    v: 1, walls: [defaultWall(1, "vertical")], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
    system: "int-vert", mode: "project", dimUnit: "m",
  };
}

// Same shape as blankSnapshot(), but pre-set to a specific system/wallSystem
// -- used when a project is created from the System Selector (see
// App.tsx's createProjectFromSystem). wallSystem lives on the wall itself
// (WallSchema.wallSystem), not the project shell, so seeding it here on the
// one starting wall is the only place it can go.
export function seedSnapshotForSystem(system: string, wallSystem?: WallSystemId): SavedProjectData {
  const orient = SYSTEMS.find(s => s.id === system)?.orient ?? "vertical";
  return {
    v: 1, walls: [{ ...defaultWall(1, orient), wallSystem: wallSystem ?? "standard" }], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
    system, mode: "project", dimUnit: "m",
  };
}

// Standalone insert, decoupled from useProjects()'s list-fetching hook so
// callers that just need to create a project (e.g. App.tsx's System
// Selector wiring) don't have to mount the whole list fetch too.
export async function insertProject(userId: string, name: string, data: SavedProjectData): Promise<{ project: ProjectRow | null; error: string | null }> {
  if (!supabase) return { project: null, error: NOT_CONFIGURED };
  const { data: row, error } = await supabase.from("projects")
    .insert({ owner_id: userId, name, data })
    .select("*").single();
  if (error) return { project: null, error: error.message };
  const parsed = ProjectRowSchema.safeParse(row);
  return parsed.success ? { project: parsed.data, error: null } : { project: null, error: BAD_SHAPE };
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
    if (!user) return { id: null, error: NOT_SIGNED_IN };
    const { project, error } = await insertProject(user.id, name, blankSnapshot());
    if (error || !project) return { id: null, error };
    setState(s => ({ ...s, projects: [project, ...s.projects] }));
    return { id: project.id, error: null };
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
