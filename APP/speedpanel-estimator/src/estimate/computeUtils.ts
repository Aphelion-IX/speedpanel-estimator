// =============================================================================
// Compute utilities
// =============================================================================
// Small shared helpers used both deep inside the compute pipeline (computeWall's
// step functions, aggregate) and directly by UI (ScheduleRow, StockBadge,
// CustomLengthSection). Kept separate from mathUtils.ts since these bake in
// domain/business constants (FIX_PER_BOX, STOCK_WASTE_THRESHOLD) rather than
// being pure generic math.
// =============================================================================
import { ceil, r3 } from "./mathUtils";
import { FIX_PER_BOX, STOCK_WASTE_THRESHOLD } from "../data";

export const boxesOf = (n: number) => n > 0 ? ceil(n / FIX_PER_BOX) : 0;
export const plural  = (n: number) => n === 1 ? "" : "s";

// Fixing quantity helper: count a fixing at the start and end of each run.
// Example: 3.0 m @ 500 mm centres = ceil(3.0 / 0.5) + 1 = 7 fixings.
export const fixingsAlong = (lm: number, spacing: number) => lm > 1e-9 ? ceil(lm / spacing) + 1 : 0;

export const orderWastePct = (offcutLM: number, spareLM: number, deliveredLM: number) =>
  deliveredLM > 1e-9 ? ((offcutLM + spareLM) / deliveredLM) * 100 : 0;

export const stockStatus = (mm: number, stocks: number[]) => {
  const req = mm / 1000;
  const exact = stocks.find(s => Math.abs(s - req) < 0.001);
  if (exact) return { type: "stocked" as const, length: exact };
  const next = stocks.find(s => s >= req - 0.001);
  if (next && (next - req) / req <= STOCK_WASTE_THRESHOLD) return { type: "near-stock" as const, length: next };
  return { type: "custom" as const, length: 0 };
};

// Shared dimension display helpers
export const makeToDisp = (dimUnit: string) => (m: string) =>
  !m || m === "0" || m === "" ? "" : dimUnit === "mm" ? String(Math.round(parseFloat(m) * 1000)) : m;
export const makeToM = (dimUnit: string) => (d: string) =>
  dimUnit === "mm" ? String(r3(parseFloat(d || "0") / 1000)) : d;
