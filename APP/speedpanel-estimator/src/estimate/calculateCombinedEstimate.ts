// =============================================================================
// calculateCombinedEstimate
// =============================================================================
// Pure (non-hook) composition of the combined-estimate's connection layer.
// Section-level materials (per wall) come from computeWall/aggregate in
// App.tsx and are NOT recalculated here -- this function only owns stage 3
// of the flow: rolling the connection materials (stage 2, see
// calculateConnectionMaterials.ts) into the totals the Easy to Order summary
// needs, while keeping the per-junction detail available for the Connection
// Breakdown card. Framework-agnostic and independently testable; the React
// binding lives in useCombinedEstimateCalc.ts.
// =============================================================================

import { calculateConnectionMaterials } from "./calculateConnectionMaterials";
import type { WallLike, ConnectionMaterial } from "./estimate.types";

export interface CombinedEstimate {
  connections: ConnectionMaterial[];
  /** Total linear metres of junction track (length x quantity, summed across all junctions). */
  connectionLM: number;
  /** Total stock pieces to order for junction track. */
  connectionPieces: number;
  connectionWarnings: string[];
}

export function calculateCombinedEstimate<T extends WallLike>(walls: T[]): CombinedEstimate {
  const connections = calculateConnectionMaterials(walls);
  let connectionLM = 0;
  let connectionPieces = 0;
  const connectionWarnings: string[] = [];
  for (const c of connections) {
    connectionLM += c.lengthM * c.quantity;
    connectionPieces += c.pieces;
    connectionWarnings.push(...c.warnings);
  }
  return {
    connections,
    connectionLM: Math.round(connectionLM * 100) / 100,
    connectionPieces,
    connectionWarnings,
  };
}
