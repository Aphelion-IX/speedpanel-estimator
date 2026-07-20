// =============================================================================
// Panel packing
// =============================================================================
// Bin-packs a wall's panel piece lengths into stock lengths (packPanels), turns
// that raw result into the display-ready PackResult (buildOption), and builds
// the custom length schedule shown for non-standard (rake/gable) profiles.
// =============================================================================
import { r1, r2, ceilDiv0 } from "./mathUtils";
import { orderWastePct } from "./computeUtils";
import { CUSTOM_MAX_LENGTH, PACK, STOCK_LENGTHS, STOCK_WASTE_THRESHOLD, HIGH_WASTE_WARNING_PCT } from "../data";
import type { CustomScheduleEntry, PanelGroup, PackResult } from "./wall.types";

// --- Panel packing ------------------------------------------------------------
export function computeCustomSchedule(strips: number[], packSize: number): CustomScheduleEntry[] {
  if (!strips.length) return [];
  const sch: { mm: number; qty: number }[] = [];
  for (let i = 0; i < strips.length; i += packSize) {
    const g = strips.slice(i, i + packSize);
    sch.push({ mm: Math.min(Math.ceil(Math.max(...g) * 1000), CUSTOM_MAX_LENGTH * 1000), qty: g.length });
  }
  const m: Record<number, number> = {};
  for (const s of sch) m[s.mm] = (m[s.mm] || 0) + s.qty;
  return Object.entries(m).sort((a, b) => +a[0] - +b[0]).map(([mm, qty]) => {
    const packs = Math.ceil(qty / packSize), ordered = packs * packSize;
    return { mm: +mm, qty, packs, ordered };
  });
}

// Gable-specific scheduling. The ridge can sit anywhere along the wall width,
// so left and right strip heights are not generally mirrors of each other --
// packs keep strips in simple left-to-right wall position order and are
// numbered sequentially (Pack 1 = leftmost strip group) so installers can
// work straight across the wall without hunting for matching lengths.
export function computeGableSchedule(strips: number[], packSize: number): CustomScheduleEntry[] {
  if (!strips.length) return [];
  const out: CustomScheduleEntry[] = [];
  let packNumber = 1;
  for (let i = 0; i < strips.length; i += packSize) {
    const g = strips.slice(i, i + packSize);
    const mm = Math.min(Math.ceil(Math.max(...g) * 1000), CUSTOM_MAX_LENGTH * 1000);
    const qty = g.length;
    const packs = Math.ceil(qty / packSize);
    out.push({ mm, qty, packs, ordered: packs * packSize, packNumber: packNumber });
    packNumber += packs;
  }
  return out;
}

export function packInfo(pieces: number, type: number) {
  const ps = PACK[type];
  const packs = ceilDiv0(pieces, ps);
  const ordered = packs * ps;
  return { packs, ordered, spare: ordered - pieces, underPack: pieces > 0 && pieces < ps, ps };
}

// Raw bin-packing result before pack-size/spare info is layered on by buildOption.
// Exactly one of the three shapes applies: success (groups present), exceeds
// (longest piece can't be cut from any available stock), or tooShort (a forced
// stock length was selected that's shorter than the longest piece needed).
export interface RawPackSuccess { groups: { stock: number; pieces: number }[]; totalPanels: number; waste: number; usedLM: number; cut: boolean; exceeds?: false; tooShort?: false; }
export interface RawPackExceeds { exceeds: true; tooShort?: false; groups?: undefined; }
export interface RawPackTooShort { tooShort: true; maxP: number; exceeds?: false; groups?: undefined; }
export type RawPack = RawPackSuccess | RawPackExceeds | RawPackTooShort;

export function packPanels(pieces: number[], forced: number | null, stocks = STOCK_LENGTHS, allowLong = false, wasteThreshold = STOCK_WASTE_THRESHOLD, packSize = 1): RawPack {
  pieces = pieces.filter(p => p > 1e-9).sort((a, b) => b - a);
  if (!pieces.length) return { groups: [], totalPanels: 0, waste: 0, usedLM: 0, cut: false };
  const maxP = pieces[0];
  if (!forced && !allowLong && maxP > 6.0 + 1e-9) return { exceeds: true };
  if (forced != null && forced < maxP - 1e-9) return { tooShort: true, maxP };
  const usedLM = pieces.reduce((a, b) => a + b, 0);
  const customCandidate = allowLong && !forced && maxP > stocks[stocks.length - 1] + 1e-9
    ? Math.min(Math.ceil(maxP * 1000) / 1000, CUSTOM_MAX_LENGTH)
    : null;
  const effectiveStocks = customCandidate != null
    ? [...stocks, customCandidate].sort((a, b) => a - b)
    : stocks;
  // When allowLong is true the 6.0 m guard above is skipped, but we still must
  // reject pieces that exceed CUSTOM_MAX_LENGTH (9.0 m) -- nothing can cut those.
  if (allowLong && maxP > CUSTOM_MAX_LENGTH + 1e-9) return { exceeds: true };
  const atLeast = (p: number) => effectiveStocks.filter(s => s >= p - 1e-9);
  const binPack = (L: number) => {
    const bins: number[] = [];
    for (const p of pieces) {
      // Guard: a piece larger than the stock length can never fit in any bin.
      // Without this check, bins.push(p) would silently create an oversized bin,
      // causing the downstream atLeast() fallback to map it to the wrong stock length.
      if (p > L + 1e-9) return null;
      let bi = -1, br = Infinity;
      for (let i = 0; i < bins.length; i++) { const r = L - bins[i]; if (r >= p - 1e-9 && r - p < br) { br = r - p; bi = i; } }
      if (bi < 0) bins.push(p); else bins[bi] += p;
    }
    return bins;
  };
  // All call sites pass mode="cut". The nocut branch has been removed.
  // If a no-cut mode is needed in future, re-introduce it here.
  const cands = (forced ? [forced] : effectiveStocks.filter(s => s >= maxP - 1e-9).length ? effectiveStocks.filter(s => s >= maxP - 1e-9) : [effectiveStocks[effectiveStocks.length - 1]]).slice().sort((a, b) => a - b);
  interface BestCandidate { waste: number; panels: number; gm: Record<number, number>; L: number; }
  let best: BestCandidate | null = null;
  for (const L of cands) {
    const bins = binPack(L);
    if (!bins) continue; // piece exceeds this stock length -- skip candidate
    const gm: Record<number, number> = {}; let pur = 0;
    for (const u of bins) { const fs = forced ? L : (atLeast(u)[0] || L); gm[fs] = (gm[fs] || 0) + 1; pur += fs; }
    const waste = pur - usedLM, wastePct = pur > 0 ? waste / pur : 0;
    if (!best || (waste < best.waste - 1e-9 && wastePct <= wasteThreshold + 1e-9)) best = { waste, panels: bins.length, gm, L };
  }
  if (!best) return { exceeds: true };
  // The per-bin atLeast() fallback above picks the tightest-fitting stock length
  // for each bin in isolation, which can spin up a standalone group for a single
  // leftover bin (e.g. one 4.2m panel) even though the wall's dominant stock
  // length already has enough pack-of-`packSize` rounding slack to absorb it for
  // free. Fold such minority groups back into the dominant length whenever doing
  // so doesn't cost more purchased material after pack quantization.
  const finalGm = forced ? best.gm : consolidateMinorityGroups(best.gm, best.L, packSize);
  const finalPur = Object.entries(finalGm).reduce((a, [s, c]) => a + Number(s) * c, 0);
  return {
    groups: Object.keys(finalGm).sort((a, b) => +a - +b).map(s => ({ stock: +s, pieces: finalGm[+s] })),
    totalPanels: best.panels, waste: finalPur - usedLM, usedLM, cut: best.panels < pieces.length,
  };
}

// Reassigns minority (non-dominant) stock-length groups from a winning bin-pack
// into the dominant stock length L when doing so is no more expensive once
// pack-of-`packSize` purchasing quantization is accounted for. Each minority
// group is compared independently against the same dominant baseline count
// (not the cumulative result of earlier merges) -- deterministic and
// order-independent, at the cost of not jointly optimizing multiple distinct
// minority groups against each other.
export function consolidateMinorityGroups(gm: Record<number, number>, L: number, packSize: number): Record<number, number> {
  const dominantCount = gm[L] || 0;
  const packCost = (n: number) => ceilDiv0(n, packSize) * packSize;
  const out: Record<number, number> = { ...gm };
  for (const key of Object.keys(gm)) {
    const ns = Number(key);
    if (ns === L) continue;
    const c = gm[ns];
    const mergedExtraLength = (packCost(dominantCount + c) - packCost(dominantCount)) * L;
    const separateLength = packCost(c) * ns;
    if (mergedExtraLength <= separateLength + 1e-9) { out[L] = (out[L] || 0) + c; delete out[ns]; }
  }
  return out;
}

export const buildOption = (raw: RawPack, type: number, highWastePct = HIGH_WASTE_WARNING_PCT): PackResult => {
  if (!Array.isArray((raw as RawPackSuccess).groups)) return {
    invalid: true, ...raw,
    groups: [], panels: 0, packs: 0, orderedInPacks: 0,
    offcut: 0, spareCount: 0, spareLen: 0, deliveredLen: 0,
    wastePct: 0, anyUnder: false, highWaste: false, usedLM: 0, cut: false,
  };
  const success = raw as RawPackSuccess;
  const groups: PanelGroup[] = success.groups.map(g => ({ ...g, label: `${r1(g.stock)} m`, ...packInfo(g.pieces, type) }));
  // When a forced stock length is set, all bins land on the same stock value, so we
  // collapse multiple groups into one and recompute packInfo on the total. This avoids
  // displaying e.g. "4.5 m x 7 panels" and "4.5 m x 5 panels" as separate rows.
  // new Set(...).size === 1 is the reliable guard: it also catches the (unlikely) case
  // where auto-select independently chooses the same stock for two separate bin-pack groups.
  const merged: PanelGroup[] = groups.length > 1 && new Set(groups.map(g => g.stock)).size === 1
    ? [{ ...groups[0], pieces: groups.reduce((a, g) => a + g.pieces, 0), ...packInfo(groups.reduce((a, g) => a + g.pieces, 0), type) }]
    : groups;
  const panels = merged.reduce((a, g) => a + g.pieces, 0);
  const packs  = merged.reduce((a, g) => a + g.packs, 0);
  const orderedInPacks = merged.reduce((a, g) => a + g.ordered, 0);
  let spareCount = 0, spareLen = 0, deliveredLen = 0;
  for (const g of merged) { spareCount += g.spare; spareLen += g.spare * g.stock; deliveredLen += g.ordered * g.stock; }
  const usedLM = success.usedLM, offcut = success.waste, wastePct = orderWastePct(offcut, spareLen, deliveredLen);
  return {
    groups: merged, panels, packs, orderedInPacks,
    offcut: r2(offcut), spareCount, spareLen: r2(spareLen), deliveredLen: r2(deliveredLen),
    wastePct, anyUnder: merged.some(g => g.underPack), highWaste: wastePct >= highWastePct,
    usedLM, cut: success.cut,
  };
};
