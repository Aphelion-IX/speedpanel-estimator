// =============================================================================
// Wall / compute-engine domain types
// =============================================================================
// Barrel re-export -- the Wall domain model, computeWall's output types, and
// its internal pipeline step types each live in their own file (wallDomain.ts,
// computeOut.types.ts, pipeline.types.ts respectively), split out for
// readability. Kept as one import path so existing call sites across the
// compute engine and the UI layer don't need to change. Deliberately separate
// from estimate.types.ts's WallLike/ConnectionMaterial, which are structural/
// decoupled from this concrete Wall shape.
// =============================================================================
export * from "./wallDomain";
export * from "./computeOut.types";
export * from "./pipeline.types";
