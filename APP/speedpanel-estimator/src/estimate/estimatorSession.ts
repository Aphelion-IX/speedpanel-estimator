// =============================================================================
// Estimator session state
// =============================================================================
// The implementation spec's §4 top-level session states (No Project / Blank
// Draft / Active Project / read-only / load-failed), derived from App.tsx's
// EXISTING openProject/noEstimate state rather than a new state container --
// see the plan's "design call" on why "No Project" is collapsed onto the
// always-seeded single blank wall instead of a real zero-wall state.
// =============================================================================
import type { WallResult } from "./computeOut.types";
import type { KitEntry } from "./synthesizeKits";

export type EstimatorSessionState = "noProject" | "blankDraft" | "active" | "readOnly" | "loadFailed";

export interface EstimatorSessionInput {
  // Whether a saved (Supabase) project is currently open -- App.tsx's openProject !== null.
  openProject: boolean;
  // isNoEstimate() below -- true only for the freshly-seeded, never-touched single wall.
  noEstimate: boolean;
  // Whether the open project is view-only for this user (see App.tsx's readOnlyProject).
  readOnly: boolean;
  // Whether opening a saved project failed (distinct from "no project open").
  loadError: boolean;
}

export function determineSessionState(input: EstimatorSessionInput): EstimatorSessionState {
  if (input.loadError) return "loadFailed";
  if (input.readOnly) return "readOnly";
  if (input.openProject) return "active";
  if (input.noEstimate) return "noProject";
  return "blankDraft";
}

// The "results.length === 1 && kits.length === 0 && results[0].out.empty"
// signal -- true only for the freshly-seeded, never-touched single wall (see
// useWallStore's defaultWall seeding). Both calculator forks' EstimateTopCard
// used to compute this formula independently; centralised here so it can't
// drift, and so InternalCalculator/ExternalCalculator can use it to choose
// between rendering firstWallSetup.tsx (No Project) and EstimateTopCard
// (Blank Draft/Active) without duplicating the formula a third time.
export function isNoEstimate(results: WallResult[], kits: KitEntry[]): boolean {
  return results.length === 1 && kits.length === 0 && results[0].out.empty;
}
