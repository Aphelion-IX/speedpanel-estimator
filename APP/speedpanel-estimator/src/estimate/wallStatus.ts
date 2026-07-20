// =============================================================================
// Wall status taxonomy
// =============================================================================
// The implementation spec's §5 status model (Not Started / Incomplete / Ready
// / Warning / Error) and §7.17's priority order, built on ./validateWall.ts.
// No status is persisted on Wall itself -- like validateWall, this is derived
// fresh from the wall + its live ComputeOut, so it can never drift out of
// sync with the actual compute/link state.
//
// Supersedes internalCalculator/phoneShell.tsx's (and its byte-identical
// externalCalculator copy's) `deriveWallStatus`/`ItemStatusKey`, which
// conflated "custom length" and "unlinked corner/shaft" into the status enum
// itself. Those files now map THIS 5-state result onto their own display
// labels/colours instead of deriving status independently -- see the
// toDisplayStatus-style mapping added at each call site.
// =============================================================================
import type { Wall } from "./wallDomain";
import type { ComputeOut } from "./computeOut.types";
import { validateWall } from "./validateWall";

export type WallStatus = "notStarted" | "incomplete" | "ready" | "warning" | "error";

// Priority order per spec §7.17: Error > Not Started > Incomplete > Warning > Ready.
export function determineWallStatus(wall: Wall, walls: Wall[], out: ComputeOut): WallStatus {
  if (out.error) return "error";
  const { issues, warnings, touched } = validateWall(wall, walls, out);
  if (!touched) return "notStarted";
  if (issues.length > 0) return "incomplete";
  if (warnings.length > 0) return "warning";
  return "ready";
}

export const WALL_STATUS_LABEL: Record<WallStatus, string> = {
  notStarted: "Not started",
  incomplete: "Incomplete",
  ready: "Ready",
  warning: "Warning",
  error: "Error",
};

// Deliberately the same literal set styleTokens.ts's StatusTone uses (ok/
// warn/danger/neutral) so callers can pass this straight into tone() without
// this file importing the UI-layer token module -- src/estimate/ stays
// framework-agnostic, per its existing convention (see computeWall.ts etc).
export const WALL_STATUS_TONE: Record<WallStatus, "ok" | "warn" | "danger" | "neutral"> = {
  notStarted: "neutral",
  incomplete: "danger",
  ready: "ok",
  warning: "warn",
  error: "danger",
};
