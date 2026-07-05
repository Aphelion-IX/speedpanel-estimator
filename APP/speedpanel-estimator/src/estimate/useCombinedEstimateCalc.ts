// =============================================================================
// useCombinedEstimateCalc
// =============================================================================
// Thin React binding over calculateCombinedEstimate (kept separate so the
// actual calculation stays a plain, framework-agnostic function -- see that
// file for what this hook returns and why).
// =============================================================================

import { useMemo } from "react";
import { calculateCombinedEstimate, type CombinedEstimate } from "./calculateCombinedEstimate";
import type { WallLike } from "./estimate.types";

export function useCombinedEstimateCalc<T extends WallLike>(walls: T[]): CombinedEstimate {
  return useMemo(() => calculateCombinedEstimate(walls), [walls]);
}
