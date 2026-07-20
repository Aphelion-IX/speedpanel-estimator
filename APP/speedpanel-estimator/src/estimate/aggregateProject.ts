// =============================================================================
// aggregateProject -- combine, don't flatten
// =============================================================================
// Internal and External are genuinely different product catalogs (different
// track/flashing SKUs; Corner/Shaft kits only make sense for Internal -- see
// aggregateInternal.ts/aggregateExternal.ts's own header comments). Flattening
// both into one line-item list would misrepresent the order, so this doesn't
// try to unify their math: it filters `results` by each wall's own
// `application` (see wallDomain.ts), runs the existing aggregate()/
// buildExtProjAgg() on each subset unchanged, and only combines the small set
// of genuinely cross-cutting top-level numbers a project-wide KPI tile needs
// (total area, total panels ordered, total warnings) into `combined`. UI that
// needs the material-line detail reads `internal`/`external` directly and
// renders an Internal materials section and an External materials section,
// each only when that side has any walls -- same "only render if non-empty"
// pattern already used for the Corner/Shaft kit section today.
// =============================================================================
import { r2 } from "./mathUtils";
import { aggregate } from "./aggregateInternal";
import { buildExtProjAgg } from "./aggregateExternal";
import type { WallResult } from "./wall.types";

export function aggregateProject(results: WallResult[]) {
  const internalResults = results.filter(r => r.wall.application === "internal");
  const externalResults = results.filter(r => r.wall.application === "external");
  const internal = aggregate(internalResults);
  const external = buildExtProjAgg(externalResults);
  const warningsCount = results.filter(r => (r.out.warnings?.length ?? 0) > 0).length;
  return {
    internal, external,
    combined: {
      totalArea: r2(internal.totalArea + external.totalArea),
      totalPanels: internal.totalPanels + external.panels,
      warningsCount,
    },
  };
}
