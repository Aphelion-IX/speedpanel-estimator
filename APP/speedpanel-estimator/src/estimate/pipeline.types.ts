// =============================================================================
// computeWall pipeline step types
// =============================================================================
// Intermediate shapes passed between computeWall's own step functions --
// internal to the compute engine, not part of its public input/output (see
// ./wallDomain.ts / ./computeOut.types.ts for those).
// =============================================================================
import type { ComputeOut } from "./computeOut.types";

// Wall geometry resolved from profile (standard/rake/gable): edge heights,
// roofline run length, area, and per-strip heights for vertical orientation.
export interface Geometry {
  W: number; Hin: number;
  leftH: number; rightH: number; apex: number; apexX: number;
  topRun: number; area: number; maxH: number;
  panelsAcross: number; stripHeights: number[];
}

// Result of height/span validation: either an early-exit (empty result) or
// the flags later steps need (steel mode, stacked/shaft horizontal condition).
export interface SpanValidation {
  exit: ComputeOut | null;
  steel: boolean;
  isStackedShaft: boolean;
}

// Panel piece lengths plus the row count for horizontal orientation (rows = 0
// for vertical, since vertical pieces come one-per-strip instead).
export interface PiecesResult { pieces: number[]; rows: number; exit: ComputeOut | null; }

// Linear-metre track quantities for C-track / J-track / Z-flashing edges.
export interface TrackLM { cLM: number; jLM: number; zLM: number; }

// Selected horizontal C-track section (profile name + fixings per face).
export interface HorizCtrack { horizProfile: string | null; horizFix: number; }

// Fixing screw quantities plus the panel-to-panel joint note shown to the user.
export interface FixingsResult { fix30: number; fix16: number; p2pNote: string; p2pEnhanced: boolean; }
