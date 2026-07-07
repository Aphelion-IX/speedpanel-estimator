// =============================================================================
// Compute-engine output types
// =============================================================================
// What computeWall's pipeline (src/estimate/computeWall.ts and its step-function
// modules) produces -- ComputeOut and its display sub-shapes. Both the compute
// engine and the UI layer depend on these. See ./wallDomain.ts for the input
// (Wall) side, and ./pipeline.types.ts for intermediate step-only shapes.
// =============================================================================
import type { Wall } from "./wallDomain";

export interface ComputeOut {
  empty: boolean; warnings: string[]; notes: string[];
  orient?: string; area?: number; chosen?: PackResult;
  cLM?: number; cStock?: number; cPieces?: number;
  jLM?: number; jPieces?: number;
  horizProfile?: string | null; horizFix?: number;
  ctrackDim?: string; jtrackDim?: string; flashDim?: string;
  flashLM?: number; flashPieces?: number;
  fix30?: number; fix16?: number; boxes30?: number; boxes16?: number;
  sausages?: number; sealantBoxes?: number;
  p2pNote?: string; p2pEnhanced?: boolean;
  maxH?: number; customSchedule?: CustomScheduleEntry[] | null;
  panelsAcross?: number; acrossCount?: number;
  result?: ExtResult; rows?: number; zLM?: number; zPieces?: number;
  pieces?: number[]; // raw panel piece lengths (one per vertical strip / horizontal row) -- used by LengthExplorer
  // Shaft wall only (wallSystem === "shaft"): floors and vertical track results.
  // cLM/cPieces/ctrackDim above are re-used for the *top+bottom* track (2xW,
  // fixed section like Standard wall); these fields are the *vertical* track
  // that runs the full shaft height, sized by floor height (see
  // estimate_shaft_wall.md section 3 and computeShaftVerticals).
  floors?: number;
  vertTrackSection?: string; vertTrackFixPerCourse?: 1 | 2; vertTrackOutsideTable?: boolean;
  vertTrackLM?: number; vertTrackPieces?: number;
  slabAnchors?: number; // informational only -- "by others", not a purchasable line item
  slabPassSausages?: number; slabPassSealantBoxes?: number; // extra sealant runs at each slab pass
  stripPieces?: number; stripLM?: number; // protection strip: one length per slab pass + junction, not per-wall head length
}

// --- Typed sub-shapes for ComputeOut (replacing any) -------------------------
export interface PanelGroup {
  stock: number;       // stock length in metres
  pieces: number;      // panels required
  packs: number;       // packs to order
  ordered: number;     // panels ordered (packs × packSize)
  spare: number;       // ordered − pieces
  label: string;       // display string e.g. "4.5 m"
  ps?: number;         // pack size for this group
  underPack?: boolean; // pieces < one full pack
}

export interface PackResult {
  invalid?: boolean;
  exceeds?: boolean;
  tooShort?: boolean;
  maxP?: number;
  groups: PanelGroup[];
  panels: number;
  packs: number;
  orderedInPacks: number;
  offcut: number;
  spareCount: number;
  spareLen: number;
  deliveredLen: number;
  wastePct: number;
  anyUnder: boolean;
  highWaste: boolean;
  usedLM: number;
  cut: boolean;
}

export interface CustomScheduleEntry {
  mm: number;
  qty: number;
  packs: number;
  ordered: number;
  packNumber?: number; // sequential position label for field installation order (gable only)
}

export interface ExtResult {
  groups: PanelGroup[];
  panels: number;
  packs: number;
  ordered: number;
  spare: number;
  wastePct: number;
  usedLM: number;
  waste: number;
}

export interface WallResult { wall: Wall; out: ComputeOut; }
