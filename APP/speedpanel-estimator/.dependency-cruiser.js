// =============================================================================
// dependency-cruiser config
// =============================================================================
// Used to mechanically enforce a "fork-not-share" convention between
// internalCalculator/ and externalCalculator/ (each kept its own copy of
// calculator-specific UI and could never import from the other). That split
// is gone -- the unified-estimator merge (see docs/unified-estimator-merge-
// plan.md) replaced both trees with one src/calculator/, where each wall
// picks its own Internal/External application at the field level (see
// wallDomain.ts's Wall.application) rather than the whole project being one
// or the other. No fork-not-share rule to enforce here any more; this stays
// around for the general no-circular check.
//
// Run with `npm run depcruise` (validates, exits non-zero on violation) or
// `npm run depcruise:graph` (writes a Mermaid dependency graph to
// depcruise-graph.mmd, gitignored -- regenerate on demand, don't commit it;
// paste its contents into a ```mermaid fence to render it).
// =============================================================================
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "warn",
      comment: "Circular imports make module boundaries harder to reason about.",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/[^/]+" },
    },
  },
};
