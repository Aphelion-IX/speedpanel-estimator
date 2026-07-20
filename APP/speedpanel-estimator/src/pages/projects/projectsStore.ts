// =============================================================================
// Saved projects -- the signed-in user's own list
// =============================================================================
// Same live-Supabase-fetch shape as admin/requests/requestsStore.ts's
// useAdminRequests -- reload() does a full refetch, single-row mutations
// optimistically patch local state on success rather than refetching.
// Requires a signed-in user (see useAuth.ts); returns a stub state with no
// user, mirroring useAdminRequests' "not configured" stub for !supabase.
// Fetch/loading/error plumbing lives in useAsyncResource.ts, shared by every
// store in this tree.
// =============================================================================
import { useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { defaultWall } from "../../wallStore";
import { SYSTEMS } from "../../appShell/systems";
import type { WallSystemId } from "../../App";
import { saveProjectSnapshot } from "./saveProjectSnapshot";
import { ProjectRowSchema, parseProjectRows, type ProjectRow, type SavedProjectData } from "./projectTypes";
import { useAsyncResource, useStableIds } from "./useAsyncResource";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const NOT_SIGNED_IN = "Sign in to see your projects.";
const BAD_SHAPE = "Unexpected data shape from the server.";

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
    system: "int-vert", dimUnit: "m",
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
    system, dimUnit: "m",
  };
}

// Standalone insert, decoupled from useProjects()'s list-fetching hook so
// callers that just need to create a project (e.g. App.tsx's System
// Selector wiring) don't have to mount the whole list fetch too. companyId,
// when provided, auto-assigns the new project to that company (see
// supabase/schema.sql's "Multi-user company workspaces" section) so
// teammates see it immediately -- omitted/null keeps today's solo behavior
// unchanged.
export interface NewProjectFields {
  builderName?: string; startDate?: string; projectManagerUserId?: string;
}

export async function insertProject(
  userId: string, name: string, data: SavedProjectData, companyId?: string | null, fields?: NewProjectFields,
): Promise<{ project: ProjectRow | null; error: string | null }> {
  if (!supabase) return { project: null, error: NOT_CONFIGURED };
  const { data: row, error } = await supabase.from("projects")
    .insert({
      owner_id: userId, name, data, company_id: companyId ?? null,
      builder_name: fields?.builderName || null,
      start_date: fields?.startDate || null,
      project_manager_user_id: fields?.projectManagerUserId || null,
    })
    .select("*").single();
  if (error) return { project: null, error: error.message };
  const parsed = ProjectRowSchema.safeParse(row);
  return parsed.success ? { project: parsed.data, error: null } : { project: null, error: BAD_SHAPE };
}

// activeCompanyId (from useCompanyMemberships) is threaded through so
// createProject() below auto-assigns new projects to it -- the list itself
// no longer filters by owner_id client-side (see fetchProjects()), trusting
// RLS (now company/project-membership-aware, see schema.sql's
// can_view_project()) the same "server is the real gate" way most other
// stores in this app already do, so a company's shared projects show up
// here without any client-side company filter either.
export function useProjects(user: User | null, activeCompanyId?: string | null) {
  const fetchProjects = useCallback(async (): Promise<{ data: ProjectRow[]; error: string | null }> => {
    if (!supabase || !user) return { data: [], error: null };
    const { data, error } = await supabase.from("projects").select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: parseProjectRows(data ?? []), error: null };
  }, [user]);

  const { data: projects, loading, error, reload, setData } = useAsyncResource(fetchProjects, [user], {
    initialData: [] as ProjectRow[],
    skip: !supabase || !user,
    skipError: !supabase ? NOT_CONFIGURED : NOT_SIGNED_IN,
  });

  const createProject = async (
    name: string,
    meta?: { reference?: string; siteAddress?: string; customerName?: string; description?: string },
    fields?: NewProjectFields,
  ): Promise<{ id: string | null; error: string | null }> => {
    if (!user) return { id: null, error: NOT_SIGNED_IN };
    const { project, error } = await insertProject(user.id, name, { ...blankSnapshot(), ...meta }, activeCompanyId, fields);
    if (error || !project) return { id: null, error };
    setData(prev => [project, ...prev]);
    return { id: project.id, error: null };
  };

  const renameProject = async (id: string, name: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setData(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    return null;
  };

  const saveSnapshot = async (id: string, data: SavedProjectData): Promise<string | null> => {
    const { error: err } = await saveProjectSnapshot(id, data);
    if (err) return err;
    setData(prev => prev.map(p => p.id === id ? { ...p, data, updated_at: new Date().toISOString() } : p));
    return null;
  };

  const deleteProject = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return error.message;
    setData(prev => prev.filter(p => p.id !== id));
    return null;
  };

  return { projects, loading, error, reload, createProject, renameProject, saveSnapshot, deleteProject };
}

// Small, separate lookup for the "client" (company) name shown on
// ProjectsListPage.tsx's rows/cards -- kept as its own parallel query rather
// than a nested `projects.select("*, companies(...))")` so ProjectRowSchema
// (shared by projectDetailStore.ts/adminProjectsStore.ts/insertProject's own
// plain `select("*")` calls) doesn't have to grow a field only this page
// needs. Same "batched .in() lookup, keyed map" convention as
// myCompaniesStore.ts. useStableIds keeps the fetch from re-running just
// because the caller passed a freshly-allocated (but content-identical)
// array this render.
export function useProjectCompanyNames(companyIds: string[]) {
  const stableIds = useStableIds(companyIds);

  const fetchNames = useCallback(async (): Promise<{ data: Map<string, string>; error: string | null }> => {
    if (!supabase || stableIds.length === 0) return { data: new Map(), error: null };
    const { data } = await supabase.from("companies").select("id, legal_name, trading_name").in("id", stableIds);
    return { data: new Map((data ?? []).map((c: { id: string; legal_name: string; trading_name: string | null }) => [c.id, c.trading_name || c.legal_name])), error: null };
  }, [stableIds]);

  const { data: names } = useAsyncResource(fetchNames, [stableIds], { initialData: new Map<string, string>() });

  return names;
}
