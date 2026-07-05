// =============================================================================
// Combined-estimate types
// =============================================================================
// Deliberately structural and self-contained (not imported from App.tsx's
// Wall/ComputeOut) so this module has no dependency on the compute engine or
// UI -- any object shaped like WallLike works. That keeps the connection/
// junction calculation pure and independently testable, per the calculation
// flow this module implements:
//
//   Raw wall inputs -> section-level estimates (computeWall, unchanged)
//                   -> connection/junction calculation (this module)
//                   -> combined material aggregation (useCombinedEstimateCalc)
// =============================================================================

export interface WallLike {
  id: number;
  name: string;
  orient: "vertical" | "horizontal";
  width: string;
  height: string;
  /** Id of another wall this one is explicitly marked as physically adjoining. */
  junctionPartnerId?: number | null;
}

/** One junction/connection material allowance between two linked walls. */
export interface ConnectionMaterial {
  /** Stable key: smaller wall id first, e.g. "3-7". */
  id: string;
  wallAId: number; wallAName: string; wallAOrient: "vertical" | "horizontal";
  wallBId: number; wallBName: string; wallBOrient: "vertical" | "horizontal";
  /** Linear metres of ONE track length at the junction (sized to the taller wall). */
  lengthM: number;
  /** Number of track lengths required (back-to-back at the junction). */
  quantity: number;
  /** Stock length used to convert lengthM x quantity into orderable pieces. */
  stock: number;
  pieces: number;
  reason: string;
  warnings: string[];
}
