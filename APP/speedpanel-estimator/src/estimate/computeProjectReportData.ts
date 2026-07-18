// =============================================================================
// computeProjectReportData -- headless estimate recompute from a saved project
// =============================================================================
// InternalCalculator.tsx/ExternalCalculator.tsx each independently call
// compute/computeExternal, aggregate/buildExtProjAgg, and
// calculateCombinedEstimate via useMemo -- all of those are plain functions
// underneath (see useWallResults/useCombinedEstimateCalc's own thin React
// wrappers), so this reproduces the exact same EstimateReportData a customer
// would see on screen, without mounting either calculator. Used by the
// Orders feature (src/pages/projects/orders/OrderBuilderPage.tsx) to price
// a project's line items at order-creation time -- see
// src/export/priceEstimateReportData.ts for what happens to the result next.
// =============================================================================
import { compute, computeExternal } from "./computeWall";
import { aggregate, buildExtProjAgg } from "./aggregate";
import { calculateCombinedEstimate } from "./calculateCombinedEstimate";
import { makeToDisp } from "./computeUtils";
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
  const combinedEstimate = calculateCombinedEstimate(data.walls);

  if (sys.ext) {
    return buildExternalReportData({
      orient, dimUnit: data.dimUnit, toDisp,
      walls: data.walls, results, warnById,
      projAgg: buildExtProjAgg(results), combinedEstimate,
    });
  }

  return buildInternalReportData({
    orient, dimUnit: data.dimUnit, toDisp,
    walls: data.walls, results, warnById,
    projChosenAgg: aggregate(results), combinedEstimate,
  });
}
