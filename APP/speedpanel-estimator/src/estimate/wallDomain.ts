// =============================================================================
// Wall domain model
// =============================================================================
// The central per-wall data model (Wall) -- what the UI edits and the compute
// engine consumes as input. See ./computeOut.types.ts for what the engine
// produces, and ./pipeline.types.ts for the intermediate shapes passed
// between computeWall's own step functions.
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

// --- Input shape for computeWall (replaces `inp: any`) -----------------------
// Orientation now lives directly on Wall, so WallInput is just an alias kept
// for readability at computeWall's call sites.
export type WallInput = Wall;

// Names of Wall's dimension fields, used by updDim (useWallStore) and dimension inputs.
export type DimField = "width" | "height" | "leftH" | "rightH" | "eavesH" | "apexH" | "ridgeX" | "floorHeight";
