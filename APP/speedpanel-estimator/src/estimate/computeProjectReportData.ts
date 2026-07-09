// =============================================================================
// computeProjectReportData -- headless estimate recompute from a saved project
// =============================================================================
// InternalCalculator.tsx/ExternalCalculator.tsx each independently call
// compute/computeExternal, aggregate/buildExtProjAgg, calculateCombinedEstimate,
// and computeCornerPair/computeShaftPair via useMemo -- all of those are plain
// functions underneath (see useWallResults/useCombinedEstimateCalc's own thin
// React wrappers), so this reproduces the exact same EstimateReportData a
// customer would see on screen, without mounting either calculator. Used by
// the Orders feature (src/pages/projects/orders/OrderBuilderPage.tsx) to price
// a project's line items at order-creation time -- see
// src/export/priceEstimateReportData.ts for what happens to the result next.
// =============================================================================
import { compute, computeExternal } from "./computeWall";
import { aggregate, buildExtProjAgg } from "./aggregate";
import { calculateCombinedEstimate } from "./calculateCombinedEstimate";
import { computeCornerPair, computeShaftPair } from "./cornerShaftKits";
import { makeToDisp } from "./computeUtils";
import { INT_CONFIG } from "../data";
import { SYSTEMS } from "../appShell/systems";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { buildExternalReportData } from "../export/buildExternalReportData";
import type { WallResult } from "./wall.types";
import type { SavedProjectData } from "../pages/projects/projectTypes";
import type { EstimateReportData } from "../export/reportTypes";

export function computeProjectReportData(data: SavedProjectData): EstimateReportData {
  if (data.walls.length === 0) throw new Error("This project has no walls to price.");

  const sys = SYSTEMS.find(s => s.id === data.system) ?? SYSTEMS[0];
  const orient = sys.orient;
  const computeFn = sys.ext ? computeExternal : compute;
  const toDisp = makeToDisp(data.dimUnit);

  const results: WallResult[] = data.walls.map(w => ({ wall: w, out: computeFn(w) }));
  const warnById = Object.fromEntries(results.map(r => [r.wall.id, !!(r.out.warnings && r.out.warnings.length > 0)]));
  const active = results.find(r => r.wall.id === data.activeId)?.wall ?? data.walls[0];
  const out = results.find(r => r.wall.id === data.activeId)?.out ?? { empty: true, warnings: [], notes: [] };
  const combinedEstimate = calculateCombinedEstimate(data.walls);

  if (sys.ext) {
    return buildExternalReportData({
      extMode: data.mode, orient, dimUnit: data.dimUnit, toDisp,
      walls: data.walls, results, warnById, active, out,
      projAgg: buildExtProjAgg(results), combinedEstimate,
    });
  }

  // cornerPair/shaftPair only matter in single-wall mode -- project mode's
  // report branch never reads them (confirmed against
  // buildInternalReportData.ts's own project-mode branch).
  let cornerPair = null, shaftPair = null;
  if (data.mode !== "project") {
    if (orient === "horizontal" && active.wallSystem === "corner" && active.cornerPartnerId) {
      const partner = data.walls.find(w => w.id === active.cornerPartnerId);
      if (partner) cornerPair = computeCornerPair(active, partner, INT_CONFIG);
    }
    if (orient === "horizontal" && active.wallSystem === "shaft" && active.shaftPartnerId) {
      const partner = data.walls.find(w => w.id === active.shaftPartnerId);
      if (partner) shaftPair = computeShaftPair(active, partner, INT_CONFIG);
    }
  }

  return buildInternalReportData({
    mode: data.mode, orient, dimUnit: data.dimUnit, toDisp,
    walls: data.walls, results, warnById, active, out,
    projChosenAgg: aggregate(results), combinedEstimate, cornerPair, shaftPair,
  });
}
