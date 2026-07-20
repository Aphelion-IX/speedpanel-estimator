// =============================================================================
// computeProjectReportData -- headless estimate recompute from a saved project
// =============================================================================
// Calculator.tsx calls compute/computeExternal, aggregateProject, and
// calculateCombinedEstimate via useMemo -- all of those are plain functions
// underneath (see useWallResults/useCombinedEstimateCalc's own thin React
// wrappers), so this reproduces the exact same EstimateReportData a customer
// would see on screen, without mounting the calculator. Used by the Orders
// feature (src/pages/projects/orders/OrderBuilderPage.tsx) to price a
// project's line items at order-creation time -- see
// src/export/priceEstimateReportData.ts for what happens to the result next.
//
// Dispatches per wall via `wall.application` (backfilled from the project's
// legacy `system` field first, for saves that predate Phase 1's per-wall
// application field -- same backfillApplication() call loadProject()/
// patchLegacyProjectRow() already make), not the legacy `system` field
// itself -- a saved project can mix Internal and External walls now, so
// there's no longer one system for the whole project to dispatch on.
// =============================================================================
import { compute, computeExternal } from "./computeWall";
import { aggregateProject } from "./aggregate";
import { calculateCombinedEstimate } from "./calculateCombinedEstimate";
import { makeToDisp } from "./computeUtils";
import { SYSTEMS } from "../appShell/systems";
import { backfillApplication, backfillOrient } from "../wallStore";
import { buildReportData } from "../export/buildReportData";
import type { WallResult } from "./wall.types";
import type { SavedProjectData } from "../pages/projects/projectTypes";
import type { EstimateReportData } from "../export/reportTypes";

export function computeProjectReportData(data: SavedProjectData): EstimateReportData {
  if (data.walls.length === 0) throw new Error("This project has no walls to price.");

  const sys = SYSTEMS.find(s => s.id === data.system) ?? SYSTEMS[0];
  const orient = sys.orient;
  const toDisp = makeToDisp(data.dimUnit);

  const walls = backfillApplication(backfillOrient(data.walls), sys.ext ? "external" : "internal");
  const results: WallResult[] = walls.map(w => ({ wall: w, out: (w.application === "external" ? computeExternal : compute)(w) }));
  const warnById = Object.fromEntries(results.map(r => [r.wall.id, !!(r.out.warnings && r.out.warnings.length > 0)]));
  const combinedEstimate = calculateCombinedEstimate(walls);

  return buildReportData({
    orient, dimUnit: data.dimUnit, toDisp,
    walls, results, warnById,
    aggProject: aggregateProject(results), combinedEstimate,
  });
}
