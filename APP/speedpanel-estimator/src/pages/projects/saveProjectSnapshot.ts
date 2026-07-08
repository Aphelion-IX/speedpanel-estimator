// =============================================================================
// saveProjectSnapshot
// =============================================================================
// One-shot fire-and-forget save, same Promise<string|null> shape as
// requestsClient.ts's submitRequest -- usable from anywhere, not just from
// inside a projectsStore.ts/projectDetailStore.ts hook instance. Needed
// because App.tsx's Save affordance on the Estimator tab (see wallStore.ts's
// loadFrom/exportSnapshot) saves the currently-open project without itself
// holding a useProjects()/useProject() hook instance for it. Both hooks also
// call this directly for their own saveSnapshot, so there's one network call
// to get right.
// =============================================================================
import { supabase } from "../../lib/supabaseClient";
import type { SavedProjectData } from "./projectTypes";

export async function saveProjectSnapshot(id: string, data: SavedProjectData): Promise<string | null> {
  if (!supabase) return "Projects aren't configured for this environment.";
  const { error } = await supabase.from("projects").update({ data, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? error.message : null;
}
