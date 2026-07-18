// =============================================================================
// dependency-cruiser config
// =============================================================================
// Mechanically enforces the "fork-not-share" convention documented in
// CLAUDE.md: internalCalculator/ and externalCalculator/ each keep their own
// copy of calculator-specific UI and must never import from one another.
// Shared code belongs in src/ui/, src/estimate/, or src/wallStore.ts instead
// -- this rule only forbids DIRECT cross-imports between the two calculator
// folders, so importing a shared sibling module is unaffected.
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
      name: "no-internal-to-external",
      severity: "error",
      comment:
        "internalCalculator must not import from externalCalculator -- they're deliberately forked, not shared (see CLAUDE.md's 'Estimator UI architecture' section).",
      from: { path: "^src/internalCalculator" },
      to: { path: "^src/externalCalculator" },
    },
    {
      name: "no-external-to-internal",
      severity: "error",
      comment:
        "externalCalculator must not import from internalCalculator -- they're deliberately forked, not shared (see CLAUDE.md's 'Estimator UI architecture' section).",
      from: { path: "^src/externalCalculator" },
      to: { path: "^src/internalCalculator" },
    },
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
