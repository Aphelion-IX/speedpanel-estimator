// =============================================================================
// Wall / compute-engine domain types
// =============================================================================
// The central per-wall data model (Wall) and everything computeWall's pipeline
// (src/estimate/computeWall.ts and its step-function modules) produces or passes
// between steps. Both the compute engine and the UI layer depend on these --
// kept separate from estimate.types.ts's WallLike/ConnectionMaterial, which are
// deliberately structural/decoupled from this concrete Wall shape.
// =============================================================================
import type { PanelType } from "../data";

export interface EdgeState { top: boolean; bottom: boolean; left: boolean; right: boolean; }

export interface Wall {
  id: number; name: string;
  // Orientation is a per-wall property (not a global toggle) so a single
  // project/combined estimate can freely mix vertical and horizontal walls.
  // The "Orientation" buttons in the UI edit *this* field on the active wall.
  orient: "vertical" | "horizontal";
  type: PanelType;
  profile: "standard" | "rake" | "gable";
  // Horizontal-only wall system variant. Not applicable to vertical walls -- UI
  // only shows this selector when orient === "horizontal". "standard" has its
  // own calculation logic per estimate_single_wall.md (fixed C-track section,
  // all edges forced restrained -- see computeWall's normalization block and
  // computeHorizCtrack). "corner"/"shaft" are placeholders that still fall
  // through to the original generic horizontal logic (span-table C-track
  // lookup, editable edges), pending their own span tables and fixing rules.
  // Once those are provided, branch on wallSystem at the relevant compute
  // steps the same way "standard" is handled now.
  wallSystem: "standard" | "corner" | "shaft";
  // Corner wall only (wallSystem === "corner", horizontal): links this run to its
  // partner run at the shared free corner (see estimate_free_corner_wall.md).
  // cornerPartnerId points at the other wall's id -- kept symmetric by the UI
  // (linking/unlinking updates both walls). cornerSide says which of this run's
  // two side edges is the free corner (post) vs. the supported far end (C-track);
  // the run's own edges/track/screws/sealant exclude that side, since the corner
  // kit (post, corner screws, corner sealant, corner strip) covers it instead.
  cornerPartnerId?: number | null;
  cornerSide?: "left" | "right";
  // Shaft wall only (wallSystem === "shaft", horizontal): height is the *total*
  // shaft height (all floors combined), and floorHeight (F) is the slab-to-
  // soffit lift used to size the vertical track (see estimate_shaft_wall.md).
  // shaftPartnerId links this stack wall to its secondary split wall, if any
  // (primary + secondary share a back-to-back C-track junction, calculated
  // once per pair -- see computeShaftPair). Symmetric, same pattern as
  // cornerPartnerId: linking/unlinking updates both walls.
  floorHeight?: string;
  shaftPartnerId?: number | null;
  // Junction partner (any orient/wallSystem): marks this wall as physically
  // adjoining another wall in the same combined project, so the combined
  // estimate can allow for the extra C/J track needed where they meet. Unlike
  // cornerPartnerId/shaftPartnerId (which drive a specific wallSystem's own
  // kit), this is a generic link available on every wall -- see
  // src/estimate/calculateConnectionMaterials.ts. Kept symmetric by the UI,
  // same pattern as the other partner links.
  junctionPartnerId?: number | null;
  width: string; height: string;
  leftH: string; rightH: string;
  eavesH: string; apexH: string; ridgeX: string;
  headFinish: "C" | "J"; bottomFinish: "C" | "J";
  leftFinish: "C" | "J"; rightFinish: "C" | "J";
  intCorners: string; extCorners: string;
  edges: EdgeState;
  headFlash: boolean; forcedStock: string;
  fullyEngaged: boolean; steelStructure: boolean;
  colour?: string; colourType?: "stocked" | "special";
}

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

// --- Input shape for computeWall (replaces `inp: any`) -----------------------
// Orientation now lives directly on Wall, so WallInput is just an alias kept
// for readability at computeWall's call sites.
export type WallInput = Wall;

// --- Intermediate pipeline shapes for the computeWall step functions ---------
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
