// =============================================================================
// saveProjectSnapshot
// =============================================================================
// One-shot fire-and-forget save, usable from anywhere, not just from inside a
// projectsStore.ts/projectDetailStore.ts hook instance. Needed because
// App.tsx's Save affordance on the Estimator tab (see wallStore.ts's
// loadFrom/exportSnapshot) saves the currently-open project without itself
// holding a useProjects()/useProject() hook instance for it. Both hooks also
// call this directly for their own saveSnapshot, so there's one network call
// to get right.
//
// Spec §11 "Project deleted while open" -- .update().eq("id", id) alone
// can't tell a real write from a no-op: if the row is gone (hard-deleted, or
// access was revoked, e.g. removed from the company) Postgrest still returns
// success with zero rows affected, no `error`. Selecting the updated row
// back turns that into a distinguishable `notFound` result, so
// App.tsx's saveOpenProject can tell "saved" apart from "this project isn't
// there/reachable any more" instead of reporting a false "All changes saved".
// =============================================================================
import { supabase } from "../../lib/supabaseClient";
import type { SavedProjectData } from "./projectTypes";

export interface SaveSnapshotResult { error: string | null; notFound?: boolean; }

export async function saveProjectSnapshot(id: string, data: SavedProjectData): Promise<SaveSnapshotResult> {
  if (!supabase) return { error: "Projects aren't configured for this environment." };
  const { data: rows, error } = await supabase.from("projects")
    .update({ data, updated_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!rows || rows.length === 0) {
    return { error: "This project is no longer accessible -- it may have been deleted, or you may have lost access.", notFound: true };
  }
  return { error: null };
}
