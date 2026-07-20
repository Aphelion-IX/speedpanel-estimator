// =============================================================================
// Project-wide aggregation
// =============================================================================
// Barrel re-export -- Internal (aggregate()) and External (buildExtProjAgg())
// project aggregation live in their own files (aggregateInternal.ts,
// aggregateExternal.ts respectively), since they share almost no code beyond
// a couple of math/data helpers. Kept as one import path so existing UI call
// sites don't need to change. aggregateProject() (aggregateProject.ts) is the
// per-wall-application-aware combiner over both, for a project that mixes
// Internal and External walls.
// =============================================================================
export * from "./aggregateInternal";
export * from "./aggregateExternal";
export * from "./aggregateProject";
