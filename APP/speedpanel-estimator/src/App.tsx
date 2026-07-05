import { useState, useMemo, useEffect, Fragment } from "react";
import {
  Layers, AlertTriangle, Lock, ChevronDown, RotateCcw,
  Box, Frame, Hammer, Plus, Trash2, Copy, Settings,
  Smartphone, Monitor,
} from "lucide-react";
import { useLayoutMode, type EffectiveLayout } from "./useLayoutMode";
import {
  type PanelType, type SystemConfig,
  PANELS, TYPES, typeFromPackSize,
  PACK, CTRACK_DIM, JTRACK_DIM, MAX_H_HORIZ,
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ, CORNER_POST_TABLE, SHAFT_TRACK_TABLE,
  PANEL_WIDTH, STOCK_WASTE_THRESHOLD, STOCK_LENGTHS, FLASH_STOCK, FIX_PER_BOX,
  HORIZ_CTRACK_STOCK, JTRACK_STOCK, SEALANT_PER_BOX,
  FLASH_DIM, EXT_HORIZ_COVER_DIM, MAX_W_HORIZ, MAX_W_HORIZ_STD_51_64,
  STEEL_MAX_H_VERT, CUSTOM_MAX_LENGTH, SHAFT_MAX_W, SHAFT_MAX_F,
  RAKE_NOTE, HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL,
  EXT_STOCK, EXT_PACK, EXT_SEALANT_PER_BOX, EXT_ZFLASH_STOCK,
  EXT_JTRACK_STOCK, EXT_CTRACK_STOCK,
  EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM, EXT_STOCKED_COLOURS, COLOUR_HEX,
  INT_CONFIG, EXT_CONFIG, INT_LOCKED, EXT_LOCKED,
} from "./data";
import { useCombinedEstimateCalc } from "./estimate/useCombinedEstimateCalc";
import type { ConnectionMaterial } from "./estimate/estimate.types";

// --- Design tokens ------------------------------------------------------------
const NAVY      = "#0B1233"; // primary body/heading text colour
const BLUE      = "#0075CC"; // primary brand colour -- selected states, links, key values
const LOGO_BLUE = "#00B0FF"; // lighter blue from the Speedpanel logo mark
const GOLD      = "#F0A800"; // accent colour -- highlights, warnings, custom/special-order badge
const WHITE     = "#FFFFFF"; // text/icon colour on filled (BLUE/GOLD) backgrounds
const MUTED     = "#94A3B8"; // inactive/unselected text & icon colour
const BORDER    = "#E2E8F0"; // standard unselected border colour
const MUTED_BG  = "#F8FAFC"; // standard unselected fill colour

// --- Single source of truth for all text sizes and spacing -------------------
//
// TYPE SCALE
//   xs  = 12px  -- metadata labels, badges, uppercase caps only
//   sm  = 14px  -- all body text: descriptions, row keys, notes, button labels
//   base= 16px  -- primary output numbers (panel counts, lengths)
//   2xl = 24px  -- stat values
//   4xl = 36px  -- app title
//
// SPACING RHYTHM
//   gap-2 / py-2  -- tight (inline chips, badges)
//   gap-3 / p-3   -- compact rows
//   gap-3 / p-4   -- standard notes/warnings
//   p-5           -- cards and sections
//   mt-3          -- between related groups
//   mt-5          -- between sections
//
const cx = {
  // -- Inputs & labels --------------------------------------------------------
  input:     "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-shadow focus:border-blue-300 focus:shadow-md focus:outline-none",
  lbl:       "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 pl-1",
  wallName:  "min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-shadow focus:border-blue-300 focus:shadow-md",

  // -- Layout containers ------------------------------------------------------
  card:      "rounded-xl border border-slate-200 bg-white p-5 shadow-sm",
  section:   "rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4",

  // -- Interactive controls ---------------------------------------------------
  // Accordions: collapsible section toggles
  accordion:      "mt-5 flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-blue-100/70",
  accordionInner: "flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 transition-colors hover:bg-blue-100/70",
  // Export/CTA button
  exportBtn: "mt-8 w-full rounded-xl py-4 text-sm font-bold tracking-widest text-white cursor-not-allowed opacity-50",

  // -- Informational boxes ----------------------------------------------------
  // Amber warning boxes
  warnbox:   "flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-800",
  // Blue info / note boxes
  infoNote:  "mt-3 flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm leading-relaxed text-blue-700",
  // Pack notes (amber, inside cards)
  packNote:  "mt-2 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-700",

  // -- Data rows -------------------------------------------------------------
  // Row key (left side label)
  rowKey:    "text-sm font-medium text-slate-400",
  rowKeyDim: "text-sm font-medium text-slate-300",
  // Row value (right side)
  rowVal:    "text-right text-sm font-semibold shrink-0",
  // Sub-detail line beneath a primary row value (stocked @ etc.)
  rowSub:    "mt-1 text-xs text-slate-400",
  // Dividers
  rowBorder: "border-b border-slate-100 pb-3 last:border-0",
  hr:        "mt-3 border-t border-slate-100 pt-3",

  // -- Section headings -------------------------------------------------------
  // Card sub-heading (Restrained edges, Corner angles, etc.)
  cardHd:    "mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 pl-1",
  cardTitle: "mb-3.5 flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold uppercase tracking-widest",
  // Section label with icon
  sectionLbl:"mb-2 mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500",

  // -- Badges & pills ---------------------------------------------------------
  pill:      "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white",
  badge:     "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",

  // -- Footnotes & auxiliary text ---------------------------------------------
  footnote:  "pt-2 text-sm leading-relaxed text-slate-400",
  // Locked-data panel wrapper
  ldWrap:    "mt-2 space-y-2.5 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500",
  ldHead:    "pt-3 pb-1 text-xs font-bold uppercase tracking-widest text-slate-500",
  // Highlighted info box inside a card (C-track section, etc.)
  infoBox:   "rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-2.5",
  infoBoxHd: "text-xs font-bold uppercase tracking-widest text-slate-500",
  infoBoxVal:"mt-1 text-sm font-bold",
  infoBoxSub:"mt-1 text-sm text-slate-500",
};

// --- TypeScript interfaces ----------------------------------------------------
interface EdgeState { top: boolean; bottom: boolean; left: boolean; right: boolean; }

interface Wall {
  id: number; name: string;
  // Orientation is a per-wall property (not a global toggle) so a single
  // project/combined estimate can freely mix vertical and horizontal walls.
  // The "Orientation" buttons in the UI edit *this* field on the active wall.
  orient: "vertical" | "horizontal";
  type: PanelType;
  profile: "standard" | "rake" | "gable";
  // Horizontal-only wall system variant. Not applicable to vertical walls -- UI
  // only shows this selector when orient === "horizontal". "standard" has its
  // own calculation logic per estimate_single_wall.md (fixed C-track section,
  // all edges forced restrained -- see computeWall's normalization block and
  // computeHorizCtrack). "corner"/"shaft" are placeholders that still fall
  // through to the original generic horizontal logic (span-table C-track
  // lookup, editable edges), pending their own span tables and fixing rules.
  // Once those are provided, branch on wallSystem at the relevant compute
  // steps the same way "standard" is handled now.
  wallSystem: "standard" | "corner" | "shaft";
  // Corner wall only (wallSystem === "corner", horizontal): links this run to its
  // partner run at the shared free corner (see estimate_free_corner_wall.md).
  // cornerPartnerId points at the other wall's id -- kept symmetric by the UI
  // (linking/unlinking updates both walls). cornerSide says which of this run's
  // two side edges is the free corner (post) vs. the supported far end (C-track);
  // the run's own edges/track/screws/sealant exclude that side, since the corner
  // kit (post, corner screws, corner sealant, corner strip) covers it instead.
  cornerPartnerId?: number | null;
  cornerSide?: "left" | "right";
  // Shaft wall only (wallSystem === "shaft", horizontal): height is the *total*
  // shaft height (all floors combined), and floorHeight (F) is the slab-to-
  // soffit lift used to size the vertical track (see estimate_shaft_wall.md).
  // shaftPartnerId links this stack wall to its secondary split wall, if any
  // (primary + secondary share a back-to-back C-track junction, calculated
  // once per pair -- see computeShaftPair). Symmetric, same pattern as
  // cornerPartnerId: linking/unlinking updates both walls.
  floorHeight?: string;
  shaftPartnerId?: number | null;
  // Junction partner (any orient/wallSystem): marks this wall as physically
  // adjoining another wall in the same combined project, so the combined
  // estimate can allow for the extra C/J track needed where they meet. Unlike
  // cornerPartnerId/shaftPartnerId (which drive a specific wallSystem's own
  // kit), this is a generic link available on every wall -- see
  // src/estimate/calculateConnectionMaterials.ts. Kept symmetric by the UI,
  // same pattern as the other partner links.
  junctionPartnerId?: number | null;
  width: string; height: string;
  leftH: string; rightH: string;
  eavesH: string; apexH: string; ridgeX: string;
  headFinish: "C" | "J"; bottomFinish: "C" | "J";
  leftFinish: "C" | "J"; rightFinish: "C" | "J";
  intCorners: string; extCorners: string;
  edges: EdgeState;
  headFlash: boolean; forcedStock: string;
  fullyEngaged: boolean; steelStructure: boolean;
  colour?: string; colourType?: "stocked" | "special";
}

interface ComputeOut {
  empty: boolean; warnings: string[]; notes: string[];
  orient?: string; area?: number; chosen?: PackResult;
  cLM?: number; cStock?: number; cPieces?: number;
  jLM?: number; jPieces?: number;
  horizProfile?: string | null; horizFix?: number;
  ctrackDim?: string; jtrackDim?: string; flashDim?: string;
  flashLM?: number; flashPieces?: number;
  fix30?: number; fix16?: number; boxes30?: number; boxes16?: number;
  sausages?: number; sealantBoxes?: number;
  p2pNote?: string; p2pEnhanced?: boolean;
  maxH?: number; customSchedule?: CustomScheduleEntry[] | null;
  panelsAcross?: number; acrossCount?: number;
  result?: ExtResult; rows?: number; zLM?: number; zPieces?: number;
  pieces?: number[]; // raw panel piece lengths (one per vertical strip / horizontal row) -- used by LengthExplorer
  // Shaft wall only (wallSystem === "shaft"): floors and vertical track results.
  // cLM/cPieces/ctrackDim above are re-used for the *top+bottom* track (2xW,
  // fixed section like Standard wall); these fields are the *vertical* track
  // that runs the full shaft height, sized by floor height (see
  // estimate_shaft_wall.md section 3 and computeShaftVerticals).
  floors?: number;
  vertTrackSection?: string; vertTrackFixPerCourse?: 1 | 2; vertTrackOutsideTable?: boolean;
  vertTrackLM?: number; vertTrackPieces?: number;
  slabAnchors?: number; // informational only -- "by others", not a purchasable line item
  slabPassSausages?: number; slabPassSealantBoxes?: number; // extra sealant runs at each slab pass
  stripPieces?: number; stripLM?: number; // protection strip: one length per slab pass + junction, not per-wall head length
}

// --- Typed sub-shapes for ComputeOut (replacing any) -------------------------
interface PanelGroup {
  stock: number;       // stock length in metres
  pieces: number;      // panels required
  packs: number;       // packs to order
  ordered: number;     // panels ordered (packs × packSize)
  spare: number;       // ordered − pieces
  label: string;       // display string e.g. "4.5 m"
  ps?: number;         // pack size for this group
  underPack?: boolean; // pieces < one full pack
}

interface PackResult {
  invalid?: boolean;
  exceeds?: boolean;
  tooShort?: boolean;
  maxP?: number;
  groups: PanelGroup[];
  panels: number;
  packs: number;
  orderedInPacks: number;
  offcut: number;
  spareCount: number;
  spareLen: number;
  deliveredLen: number;
  wastePct: number;
  anyUnder: boolean;
  highWaste: boolean;
  usedLM: number;
  cut: boolean;
}

interface CustomScheduleEntry {
  mm: number;
  qty: number;
  packs: number;
  ordered: number;
  packNumber?: number; // sequential position label for field installation order (gable only)
}

interface ExtResult {
  groups: PanelGroup[];
  panels: number;
  packs: number;
  ordered: number;
  spare: number;
  wastePct: number;
  usedLM: number;
  waste: number;
}

interface WallResult { wall: Wall; out: ComputeOut; }

// --- Input shape for computeWall (replaces `inp: any`) -----------------------
// Orientation now lives directly on Wall, so WallInput is just an alias kept
// for readability at computeWall's call sites.
type WallInput = Wall;

// --- Intermediate pipeline shapes for the computeWall step functions ---------
// Wall geometry resolved from profile (standard/rake/gable): edge heights,
// roofline run length, area, and per-strip heights for vertical orientation.
interface Geometry {
  W: number; Hin: number;
  leftH: number; rightH: number; apex: number; apexX: number;
  topRun: number; area: number; maxH: number;
  panelsAcross: number; stripHeights: number[];
}

// Result of height/span validation: either an early-exit (empty result) or
// the flags later steps need (steel mode, stacked/shaft horizontal condition).
interface SpanValidation {
  exit: ComputeOut | null;
  steel: boolean;
  isStackedShaft: boolean;
}

// Panel piece lengths plus the row count for horizontal orientation (rows = 0
// for vertical, since vertical pieces come one-per-strip instead).
interface PiecesResult { pieces: number[]; rows: number; exit: ComputeOut | null; }

// Linear-metre track quantities for C-track / J-track / Z-flashing edges.
interface TrackLM { cLM: number; jLM: number; zLM: number; }

// Selected horizontal C-track section (profile name + fixings per face).
interface HorizCtrack { horizProfile: string | null; horizFix: number; }

// Fixing screw quantities plus the panel-to-panel joint note shown to the user.
interface FixingsResult { fix30: number; fix16: number; p2pNote: string; p2pEnhanced: boolean; }

// --- Internal system constants ------------------------------------------------
// Product data (stock lengths, packs, track dims, span/corner tables, colours,
// int/ext config, etc.) now lives in ./data -- imported at the top of this file.

// --- Utility functions --------------------------------------------------------
// ceil subtracts a tiny epsilon before rounding so that values that are
// mathematically exact integers but land just above due to floating-point
// error (e.g. 3.0000000001) are not incorrectly rounded up to the next integer.
const ceil    = (x: number) => Math.ceil(x - 1e-9);
const r2      = (x: number) => Math.round(x * 100) / 100;
const r1      = (x: number) => Math.round(x * 10) / 10;
const r3      = (x: number) => Math.round(x * 1000) / 1000;
const clamp   = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const boxesOf = (n: number) => n > 0 ? ceil(n / FIX_PER_BOX) : 0;
const plural  = (n: number) => n === 1 ? "" : "s";

// Fixing quantity helper: count a fixing at the start and end of each run.
// Example: 3.0 m @ 500 mm centres = ceil(3.0 / 0.5) + 1 = 7 fixings.
const fixingsAlong = (lm: number, spacing: number) => lm > 1e-9 ? ceil(lm / spacing) + 1 : 0;

const orderWastePct = (offcutLM: number, spareLM: number, deliveredLM: number) =>
  deliveredLM > 1e-9 ? ((offcutLM + spareLM) / deliveredLM) * 100 : 0;

const stockStatus = (mm: number, stocks: number[]) => {
  const req = mm / 1000;
  const exact = stocks.find(s => Math.abs(s - req) < 0.001);
  if (exact) return { type: "stocked" as const, length: exact };
  const next = stocks.find(s => s >= req - 0.001);
  if (next && (next - req) / req <= STOCK_WASTE_THRESHOLD) return { type: "near-stock" as const, length: next };
  return { type: "custom" as const, length: 0 };
};

// Shared dimension display helpers
const makeToDisp = (dimUnit: string) => (m: string) =>
  !m || m === "0" || m === "" ? "" : dimUnit === "mm" ? String(Math.round(parseFloat(m) * 1000)) : m;
const makeToM = (dimUnit: string) => (d: string) =>
  dimUnit === "mm" ? String(r3(parseFloat(d || "0") / 1000)) : d;

// --- Panel packing ------------------------------------------------------------
function computeCustomSchedule(strips: number[], packSize: number): CustomScheduleEntry[] {
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
function computeGableSchedule(strips: number[], packSize: number): CustomScheduleEntry[] {
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

function packInfo(pieces: number, type: number) {
  const ps = PACK[type];
  const packs = pieces > 0 ? ceil(pieces / ps) : 0;
  const ordered = packs * ps;
  return { packs, ordered, spare: ordered - pieces, underPack: pieces > 0 && pieces < ps, ps };
}

// Raw bin-packing result before pack-size/spare info is layered on by buildOption.
// Exactly one of the three shapes applies: success (groups present), exceeds
// (longest piece can't be cut from any available stock), or tooShort (a forced
// stock length was selected that's shorter than the longest piece needed).
interface RawPackSuccess { groups: { stock: number; pieces: number }[]; totalPanels: number; waste: number; usedLM: number; cut: boolean; exceeds?: false; tooShort?: false; }
interface RawPackExceeds { exceeds: true; tooShort?: false; groups?: undefined; }
interface RawPackTooShort { tooShort: true; maxP: number; exceeds?: false; groups?: undefined; }
type RawPack = RawPackSuccess | RawPackExceeds | RawPackTooShort;

function packPanels(pieces: number[], forced: number | null, stocks = STOCK_LENGTHS, allowLong = false): RawPack {
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
  interface BestCandidate { waste: number; panels: number; gm: Record<number, number>; }
  let best: BestCandidate | null = null;
  for (const L of cands) {
    const bins = binPack(L);
    if (!bins) continue; // piece exceeds this stock length -- skip candidate
    const gm: Record<number, number> = {}; let pur = 0;
    for (const u of bins) { const fs = forced ? L : (atLeast(u)[0] || L); gm[fs] = (gm[fs] || 0) + 1; pur += fs; }
    const waste = pur - usedLM, wastePct = pur > 0 ? waste / pur : 0;
    if (!best || (waste < best.waste - 1e-9 && wastePct <= STOCK_WASTE_THRESHOLD + 1e-9)) best = { waste, panels: bins.length, gm };
  }
  if (!best) return { exceeds: true };
  return { groups: Object.keys(best.gm).sort((a, b) => +a - +b).map(s => ({ stock: +s, pieces: best.gm[+s] })), totalPanels: best.panels, waste: best.waste, usedLM, cut: best.panels < pieces.length };
}

const buildOption = (raw: RawPack, type: number): PackResult => {
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
    wastePct, anyUnder: merged.some(g => g.underPack), highWaste: wastePct >= 15,
    usedLM, cut: success.cut,
  };
};

// --- C-track selection (spec Table 3) ----------------------------------------
// Data-driven from PANELS[].horizCtrack: return the first ordered band whose
// W/H envelope contains the wall (the band list is ordered narrower-W/shorter-H
// first, so this reproduces the original spec-table lookup exactly). Returns
// null when W/H is beyond every band (e.g. W > 4.5 m).
const pickHorizCtrack = (type: number, W: number, H: number) => {
  const panel = PANELS.find(p => p.type === type);
  const band = panel?.horizCtrack.find(b => W <= b.wMax && H <= b.hMax);
  return band ? { t: band.section, fix: band.fix, outsideTable: !!band.outsideTable } : null;
};

// --- Corner post selection (Corner wall system, spec Table B) ----------------
// See estimate_free_corner_wall.md section 3. Unlike pickHorizCtrack's exact
// interval bands, this is a simple row/column step-up lookup: find the first
// width column >= W and the first height row >= H, read that cell. If W or H
// exceeds every column/row, it's outside the table (caller shows a warning).
interface CornerPostResult { section: string; fixPerCourse: 1 | 2; outsideTable: boolean; }

// CORNER_POST_TABLE now lives in ./data (derived from the PANELS catalog).
const pickCornerPost = (type: number, W: number, H: number): CornerPostResult | null => {
  // P78 footnote (dagger/double-dagger in the doc): at 6.0 m tall the 1-screw/
  // course width breakpoint shifts from 3.0 m to 3.5 m -- handle this exact
  // height band separately since it doesn't fit the rectangular column/row grid.
  if (type === 78 && H > 4.5 + 1e-9 && H <= 6.0 + 1e-9) {
    if (W <= 3.5 + 1e-9) return { section: "90 x 84 x 1.95", fixPerCourse: 1, outsideTable: false };
    if (W <= 4.5 + 1e-9) return { section: "90 x 84 x 1.95", fixPerCourse: 2, outsideTable: false };
    return { section: "90 x 84 x 1.95", fixPerCourse: 2, outsideTable: true };
  }
  const cols = CORNER_POST_TABLE[type];
  if (!cols) return null;
  const col = cols.find(c => W <= c.maxW + 1e-9);
  if (!col) return { section: cols[cols.length - 1].rows[cols[cols.length - 1].rows.length - 1].section, fixPerCourse: 1, outsideTable: true };
  const row = col.rows.find(r => H <= r.maxH + 1e-9);
  if (!row) return { section: col.rows[col.rows.length - 1].section, fixPerCourse: (col.rows[col.rows.length - 1].fixPerCourse ?? 1), outsideTable: true };
  return { section: row.section, fixPerCourse: row.fixPerCourse ?? 1, outsideTable: false };
};

// --- Shaft wall vertical track selection (Table C) ----------------------------
// See estimate_shaft_wall.md section 3. Sized by floor height F alone (not
// width/height like Corner wall's post) -- a step-up lookup, same convention
// as pickCornerPost: find the first floor-height row >= F, read that cell.
interface ShaftTrackResult { section: string; fixPerCourse: 1 | 2; outsideTable: boolean; }

// SHAFT_TRACK_TABLE now lives in ./data.
const pickShaftVerticalTrack = (F: number): ShaftTrackResult => {
  const row = SHAFT_TRACK_TABLE.find(r => F <= r.maxF + 1e-9);
  if (!row) { const last = SHAFT_TRACK_TABLE[SHAFT_TRACK_TABLE.length - 1]; return { ...last, outsideTable: true }; }
  return { ...row, outsideTable: false };
};

// Height of an asymmetric gable's roofline at horizontal position x (0..W).
// Left side rises linearly from leftH (at x=0) to apex (at x=ridgeX);
// right side falls linearly from apex (at x=ridgeX) to rightH (at x=W).
const gableHeightAtX = (x: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  if (W <= 0) return 0;
  const xx = clamp(x, 0, W);
  const xr = clamp(ridgeX, 0, W);
  if (xx <= xr) {
    if (xr <= 1e-9) return apex;
    return leftH + (apex - leftH) * (xx / xr);
  }
  const rightRun = W - xr;
  if (rightRun <= 1e-9) return apex;
  return apex + (rightH - apex) * ((xx - xr) / rightRun);
};

// For a vertical strip spanning [startX, endX), the panel must be cut to the
// tallest point within that span -- which is the higher of its two edges, or
// the ridge height itself if the ridge falls inside the strip.
const gableMaxHeightInBay = (startX: number, endX: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  const hStart = gableHeightAtX(startX, W, leftH, apex, ridgeX, rightH);
  const hEnd = gableHeightAtX(endX, W, leftH, apex, ridgeX, rightH);
  const ridgeInsideBay = ridgeX >= startX - 1e-9 && ridgeX <= endX + 1e-9;
  return Math.max(hStart, hEnd, ridgeInsideBay ? apex : 0);
};

// Width of a horizontal row at height y for an asymmetric gable: the row spans
// from wherever the left slope crosses y to wherever the right slope crosses y.
const gableRowWidth = (y: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  if (W <= 0) return 0;
  if (y <= Math.min(leftH, rightH)) return W;
  if (y >= apex) return 0;
  const xr = clamp(ridgeX, 0, W);
  let xLeft = 0;
  if (y > leftH) {
    if (apex <= leftH) return 0;
    xLeft = ((y - leftH) / (apex - leftH)) * xr;
  }
  let xRight = W;
  if (y > rightH) {
    if (apex <= rightH) return 0;
    xRight = W - ((y - rightH) / (apex - rightH)) * (W - xr);
  }
  return Math.max(0, xRight - xLeft);
};

const rowWidth = (profile: string, y: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) => {
  if (profile === "standard") return W;
  if (profile === "rake") {
    const lo = Math.min(leftH, rightH), hi = Math.max(leftH, rightH);
    if (y <= lo) return W; if (y >= hi) return 0;
    return (W * (hi - y)) / (hi - lo);
  }
  return gableRowWidth(y, W, leftH, apex, apexX, rightH);
};

// Horizontal raked/gable rows must be cut to the widest point inside the
// 250 mm row band, not the centreline width. Centreline sampling can under-cut
// the panel on sloped walls.
const rowWidthBandMax = (profile: string, yBottom: number, yTop: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) =>
  Math.max(
    rowWidth(profile, yBottom, W, leftH, rightH, apex, apexX),
    rowWidth(profile, yTop, W, leftH, rightH, apex, apexX),
  );

const horizontalJointCoverLM = (profile: string, rows: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) => {
  let lm = 0;
  for (let j = 1; j < rows; j++) lm += rowWidth(profile, j * PANEL_WIDTH, W, leftH, rightH, apex, apexX);
  return lm;
};

// SystemConfig + INT_CONFIG/EXT_CONFIG now live in ./data.

// --- Unified compute core -----------------------------------------------------
// computeWall is the single entry point used by both internal and external
// systems (config-driven via SystemConfig). It's broken into named steps below
// so each stage of the estimate -- geometry, span validation, panel pieces,
// track linear metres, C-track selection, fixings, custom schedules -- can be
// read, tested, and modified independently. Steps that can short-circuit the
// whole estimate (geometry, span validation, piece generation) return an
// `exit: ComputeOut | null` field; computeWall checks each one in turn and
// returns early the moment a step produces an exit value.

/** Step 1: resolve wall geometry (edge heights, area, roofline run, strip heights) from profile. */
function resolveGeometry(inp: WallInput, W: number): Geometry {
  const { orient, profile } = inp;
  const Hin = parseFloat(inp.height) || 0;
  const panelsAcross = ceil(W / PANEL_WIDTH);
  let leftH = 0, rightH = 0, topRun = 0, area = 0, maxH = 0;
  let apex = 0, apexX = 0;

  if (profile === "standard") {
    leftH = rightH = Hin; topRun = W; area = W * Hin; maxH = Hin;
  } else if (profile === "rake") {
    leftH = parseFloat(inp.leftH) || 0; rightH = parseFloat(inp.rightH) || 0;
    topRun = Math.hypot(W, rightH - leftH); area = (W * (leftH + rightH)) / 2; maxH = Math.max(leftH, rightH);
  } else {
    // Gable: left/right eaves heights can differ, and the ridge (apex) can sit
    // anywhere along the width. Existing walls that only set eavesH (legacy
    // centred-symmetric gable) fall back to that single value on both sides.
    const legacyEaves = parseFloat(inp.eavesH) || 0;
    leftH = parseFloat(inp.leftH) || legacyEaves;
    rightH = parseFloat(inp.rightH) || legacyEaves;
    apex = parseFloat(inp.apexH) || 0;
    const ridgeRaw = parseFloat(inp.ridgeX);
    apexX = Number.isFinite(ridgeRaw) && ridgeRaw > 0 ? clamp(ridgeRaw, 0, W) : W / 2;
    topRun = Math.hypot(apexX, apex - leftH) + Math.hypot(W - apexX, apex - rightH);
    area = ((leftH + apex) / 2) * apexX + ((apex + rightH) / 2) * (W - apexX);
    maxH = Math.max(leftH, rightH, apex);
  }

  // Strip heights (vertical orientation only -- horizontal builds row widths later).
  // For standard profile every strip is the same height. For rake and gable, each
  // strip is cut to the tallest point within its own width span -- the higher of
  // its two edges (a panel must be tall enough to cover its full bay, not just its
  // centre point; sampling at the centreline would under-cut every panel by half
  // the local rise, since the panel's high edge is always taller than its midpoint
  // on a sloped wall).
  const stripHeights: number[] = [];
  if (orient === "vertical") {
    for (let i = 0; i < panelsAcross; i++) {
      if (profile === "standard") { stripHeights.push(Hin); continue; }
      const startX = i * PANEL_WIDTH;
      const endX = Math.min(W, (i + 1) * PANEL_WIDTH);
      if (profile === "rake") {
        const hAtStart = leftH + (rightH - leftH) * (startX / W);
        const hAtEnd = leftH + (rightH - leftH) * (endX / W);
        stripHeights.push(Math.max(hAtStart, hAtEnd));
      } else {
        stripHeights.push(gableMaxHeightInBay(startX, endX, W, leftH, apex, apexX, rightH));
      }
    }
  }

  return { W, Hin, leftH, rightH, apex, apexX, topRun, area, maxH, panelsAcross, stripHeights };
}

/** Geometry-only warnings/notes that don't gate further computation (gable apex check, profile/gable notes). */
function geometryNotes(inp: WallInput, geo: Geometry, cfg: SystemConfig): { warnings: string[]; notes: string[] } {
  const { orient, profile } = inp;
  const warnings: string[] = [], notes: string[] = [];
  if (profile === "gable" && geo.apex <= Math.max(geo.leftH, geo.rightH)) {
    warnings.push("Gable apex/ridge height must be greater than both eaves heights.");
  }
  if (profile !== "standard") notes.push(orient === "vertical" ? "Raked/gable/sloped vertical -- estimated only. Confirm with Speedpanel." : "Raked/gable/sloped horizontal -- estimated only. Confirm with Speedpanel.");
  if (profile === "gable" && orient === "vertical") notes.push("Gable panel schedule is numbered left to right in installation order.");
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "standard")
    notes.push("Standard wall: fixed C-track section (no span-table lookup), all four edges restrained.");
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "corner")
    notes.push("Corner wall run: fixed C-track section on the supported side; the free-corner side is covered by the linked corner kit.");
  return { warnings, notes };
}

/** Step 2: height/span validation against the system config's limits. May set `exit` to short-circuit the estimate. */
function validateSpan(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[], notes: string[]): SpanValidation {
  const { orient, type } = inp;
  const { W, maxH } = geo;
  const steel = !!inp.steelStructure;
  const maxHVert = steel ? STEEL_MAX_H_VERT : cfg.maxHVertFn(type);

  // "Shaft wall" (see estimate_shaft_wall.md), Internal only: total height
  // stacks to any height (no cap), so the standard horizontal maxH/maxW checks
  // below don't apply -- only the width limit (primary <= 5.0 m, the "wider
  // option" ceiling) and the floor-height limit (<= 6.0 m, checked separately
  // in computeShaftVerticals since floorHeight isn't part of Geometry). Note:
  // this is a different concept from the existing isStackedShaft flag below,
  // which is the P78-width-driven "stacked/shaft condition" for the *generic*
  // horizontal system -- unrelated to wallSystem === "shaft".
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    if (W > SHAFT_MAX_W + 1e-9) {
      warnings.push(`Shaft wall width exceeds the ${SHAFT_MAX_W} m limit. Contact Speedpanel.`);
      return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
      warnings.push("Not all edges restrained -- outside standard shaft config. Contact Speedpanel.");
    return { exit: null, steel, isStackedShaft: false };
  }

  if (orient === "vertical") {
    if (steel) notes.push(`Steel structure: vertical max height raised to ${STEEL_MAX_H_VERT} m.`);
    if (maxH > maxHVert + 1e-9) {
      warnings.push(`Wall height exceeds the ${steel ? `steel structure limit (${STEEL_MAX_H_VERT}m)` : `standard vertical limit for the ${type} mm panel`}. Contact Speedpanel.`);
      if (!steel) return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (maxH > 6.0 + 1e-9 && !steel) warnings.push("Wall height exceeds 6.0 m stock max. Contact Speedpanel.");
    if (maxH > 6.0 + 1e-9 && steel) notes.push("Height exceeds 6m -- panels site-joined. Confirm jointing with Speedpanel.");
    if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
      warnings.push("Not all edges restrained -- outside standard vertical config. Contact Speedpanel.");
    return { exit: null, steel, isStackedShaft: false };
  }

  const isStacked = W > cfg.maxWHoriz + 1e-9 && W <= cfg.maxWStack + 1e-9;
  if (W > cfg.maxWStack + 1e-9) {
    warnings.push(`Wall width exceeds the ${type} mm clear span limit (${cfg.maxWStack} m). Contact Speedpanel.`);
    return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
  }
  // P51/P64 internal additional check
  if (!cfg.hasZFlash && (type === 51 || type === 64)) {
    if (W > cfg.maxWHoriz + 1e-9 || maxH > cfg.maxHHorizFn(type) + 1e-9) {
      warnings.push(`Wall dimensions are outside the calculator scope for the ${type} mm panel. Contact Speedpanel.`);
      return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (W > MAX_W_HORIZ_STD_51_64 + 1e-9) notes.push(`${type} mm panel: width in extended span range (4.0-4.5 m). Special detailing required.`);
  } else {
    if (inp.fullyEngaged) {
      notes.push(`Fully engaged S-to-S: horiz height ${steel ? `unlimited (steel -- max ${STEEL_MAX_H_VERT} m)` : "unlimited"}.`);
      if (steel && maxH > STEEL_MAX_H_VERT + 1e-9) warnings.push(`Wall height exceeds the steel structure maximum (${STEEL_MAX_H_VERT} m).`);
    } else if (isStacked) {
      notes.push("78 mm stacked / shaft condition. Height is treated as unlimited for material estimating only.");
    } else if (maxH > cfg.maxHHorizFn(type) + 1e-9) {
      warnings.push("Wall height exceeds the standard 6.0 m horizontal limit. Quantities shown are estimated from dimensions entered.");
    }
  }
  if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
    warnings.push("Not all edges restrained -- outside standard horizontal config. Contact Speedpanel.");

  return { exit: null, steel, isStackedShaft: isStacked };
}

/** Step 3: build the flat list of panel piece lengths (one per vertical strip, or one per horizontal row). */
function buildPieces(inp: WallInput, geo: Geometry, cfg: SystemConfig, steel: boolean, forced: number | null, warnings: string[], notes: string[]): PiecesResult {
  const { orient, profile } = inp;
  const { W, leftH, rightH, apex, apexX, maxH, stripHeights } = geo;
  let pieces: number[] = [], rows = 0;

  if (orient === "vertical") {
    // For steel-structure standard-profile vertical walls, panels taller than the
    // maximum stock length (6.0 m) must be site-joined. Split each strip at the
    // stock boundary so packPanels schedules them as separate cut lengths (e.g. a
    // 9 m strip becomes a 6.0 m piece + a 3.0 m piece). Non-standard profiles
    // (rake/gable) already produce per-strip heights that are naturally <= maxH
    // and are passed to computeCustomSchedule, so no splitting is needed there.
    const maxStock = cfg.stocks[cfg.stocks.length - 1]; // 6.0 m for internal
    for (const h of stripHeights) {
      if (steel && profile === "standard" && h > maxStock + 1e-9) {
        // Divide the strip into as many full-stock sections as needed, plus a remainder.
        let remaining = h;
        while (remaining > 1e-9) {
          pieces.push(Math.min(remaining, maxStock));
          remaining -= maxStock;
        }
      } else {
        pieces.push(h);
      }
    }
  } else {
    rows = ceil(maxH / PANEL_WIDTH);
    const maxStock = forced ?? cfg.stocks[cfg.stocks.length - 1];
    for (let i = 0; i < rows; i++) {
      const yBottom = i * PANEL_WIDTH;
      const yTop = (i + 1) * PANEL_WIDTH;
      const w = rowWidthBandMax(profile, yBottom, yTop, W, leftH, rightH, apex, apexX);
      if (w <= 1e-9) continue;
      if (w > maxStock + 1e-9) {
        warnings.push(`Wall width ${r2(W)} m exceeds max panel length (${r1(maxStock)} m).`);
        return { pieces: [], rows, exit: { empty: true, warnings, notes } };
      }
      pieces.push(w);
    }
  }

  return { pieces, rows, exit: null };
}

/** Step 4: linear-metre track quantities for C-track/J-track/Z-flashing, by edge. */
function computeTrackLM(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[]): TrackLM {
  const { orient, type, edges } = inp;
  const { W, leftH, rightH, topRun } = geo;
  const jValid = cfg.jValidFn(type);
  let cLM = 0, jLM = 0, zLM = 0;

  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    // "Shaft wall" (see estimate_shaft_wall.md): top+bottom track only (2xW) --
    // the two vertical edges are the dedicated full-height vertical track
    // (sized by floor height, computed separately in computeShaftVerticals),
    // not counted here to avoid double-counting them as ordinary C-track too.
    cLM = r2(2 * W);
  } else if (!cfg.hasZFlash) {
    // Internal: J-track selectable per edge
    if (orient === "vertical" && inp.headFinish   === "J" && !jValid) warnings.push("J-track head finish is P78 only.");
    if (orient === "vertical" && inp.bottomFinish === "J" && !jValid) warnings.push("J-track bottom finish is P78 only.");
    if (orient === "vertical" && (inp.leftFinish === "J" || inp.rightFinish === "J") && !jValid) warnings.push("J-track is P78 only -- side edges estimated as C-track.");
    const useJHead   = orient === "vertical" && inp.headFinish   === "J" && jValid;
    const useJBottom = orient === "vertical" && inp.bottomFinish === "J" && jValid;
    const useJLeft   = orient === "vertical" && inp.leftFinish   === "J" && jValid;
    const useJRight  = orient === "vertical" && inp.rightFinish  === "J" && jValid;
    if (edges.top)    useJHead   ? (jLM += topRun) : (cLM += topRun);
    if (edges.bottom) useJBottom ? (jLM += W)      : (cLM += W);
    if (edges.left)   useJLeft   ? (jLM += leftH)  : (cLM += leftH);
    if (edges.right)  useJRight  ? (jLM += rightH) : (cLM += rightH);
  } else {
    // External: base=J-track+Z-flashing, head+sides=C-track
    cLM = r2((edges.top ? topRun : 0) + (edges.left ? leftH : 0) + (edges.right ? rightH : 0));
    jLM = edges.bottom ? r2(W) : 0;
    zLM = edges.bottom ? r2(W) : 0;
  }

  return { cLM, jLM, zLM };
}

/** Step 5: horizontal-only C-track section selection (span-table lookup, engaged/stacked overrides). */
function computeHorizCtrack(inp: WallInput, geo: Geometry, cfg: SystemConfig, isStackedShaft: boolean, notes: string[], warnings: string[]): HorizCtrack {
  const { orient, type } = inp;
  const { W, maxH } = geo;
  if (orient !== "horizontal") return { horizProfile: null, horizFix: 1 };

  // "Standard wall", "Corner wall", and "Shaft wall" (Internal only,
  // !cfg.hasZFlash): one fixed C-track section regardless of height -- no
  // span-table lookup (see estimate_single_wall.md, estimate_free_corner_wall.md,
  // estimate_shaft_wall.md). Corner wall's run-level C-track (the supported far
  // end, not the post) and Shaft wall's top+bottom track (not the vertical
  // track, which has its own separate lookup -- pickShaftVerticalTrack, in
  // computeShaftVerticals) both use the same fixed section. horizProfile stays
  // null so ctrackDimFn falls back to CTRACK_DIM[type].
  if (!cfg.hasZFlash && (inp.wallSystem === "standard" || inp.wallSystem === "corner" || inp.wallSystem === "shaft")) return { horizProfile: null, horizFix: 1 };

  const engaged = type === 78 && inp.fullyEngaged;
  if (engaged) return { horizProfile: "90 x 84 x 1.92", horizFix: 1 };
  if (isStackedShaft) return { horizProfile: "Stacked / shaft condition", horizFix: 1 };
  if (W > cfg.maxWHoriz + 1e-9) return { horizProfile: null, horizFix: 1 };

  const p = pickHorizCtrack(type, W, maxH);
  if (!p) {
    warnings.push("Wall size outside the standard horizontal C-track table. Contact Speedpanel.");
    return { horizProfile: null, horizFix: 1 };
  }
  if (p.outsideTable) notes.push(`Height exceeds the standard C-track span table. Minimum section selected conservatively as ${p.t} with ${p.fix} fixing${p.fix > 1 ? "s" : ""} each face -- confirm with Speedpanel.`);
  return { horizProfile: p.t, horizFix: p.fix };
}

/** Step 6: fixing screw counts (10g-30mm perimeter/flashing, 10g-16mm panel-to-panel joints). */
function computeFixings(inp: WallInput, geo: Geometry, cfg: SystemConfig, rows: number, isStackedShaft: boolean, horiz: HorizCtrack): FixingsResult {
  const { orient, type, profile, edges } = inp;
  const { W, Hin, leftH, rightH, topRun, maxH, panelsAcross, stripHeights } = geo;

  // "Standard wall" horizontal system (see estimate_single_wall.md), Internal
  // only (!cfg.hasZFlash): simpler, uniform fixing centres rather than the
  // generic horizontal system's per-edge/span-table-driven pattern below.
  // Perimeter screws are 250 mm centres on both faces around all four sides
  // (edges are already forced on by computeWall's normalization); panel-to-
  // panel screws are 1000 mm centres on one face. All four edges are
  // guaranteed on here, so no edge.top/bottom/left/right gating is needed.
  // Perimeter = topRun + W (base) + leftH + rightH -- topRun/leftH/rightH
  // equal W/maxH/maxH respectively for a standard (non-raked/gable)
  // rectangular wall, matching the doc's "2W + 2H".
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "standard") {
    const edgeFixings = fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25) + fixingsAlong(leftH, 0.25) + fixingsAlong(rightH, 0.25);
    const fix30 = edgeFixings * 2 + (inp.headFlash ? 2 * fixingsAlong(topRun, 0.5) : 0);
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  // "Shaft wall" (see estimate_shaft_wall.md), Internal only (!cfg.hasZFlash):
  // fix30 (panel-to-track) is 0 here -- Shaft wall's only panel-to-track screws
  // are the vertical-track ones, computed in computeShaftVerticals (which has
  // floor height / floors available; this function doesn't) and added into
  // the final fix30 by the computeWall orchestrator. fix16 (panel-to-panel)
  // uses the same uniform 1000 mm/one-face convention as the other systems.
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30: 0, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  // "Corner wall" (see estimate_free_corner_wall.md), Internal only
  // (!cfg.hasZFlash): same uniform 250 mm/both-faces convention as Standard
  // wall, but only across this run's 3 edges (top, bottom, and whichever side
  // isn't the free corner -- computeWall's normalization already set edges
  // accordingly, so summing whichever of leftH/rightH is "on" gives the doc's
  // "2W + H" perimeter for free). The corner side's screws are covered
  // separately, once per pair, by computeCornerPair -- not counted here.
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "corner") {
    const sideFixings = (edges.left ? fixingsAlong(leftH, 0.25) : 0) + (edges.right ? fixingsAlong(rightH, 0.25) : 0);
    const edgeFixings = fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25) + sideFixings;
    const fix30 = edgeFixings * 2 + (inp.headFlash ? 2 * fixingsAlong(topRun, 0.5) : 0);
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  const engaged = orient === "horizontal" && type === 78 && inp.fullyEngaged;

  let fix30 = 0;
  if (engaged) {
    fix30 += fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25);
    if (edges.left)  fix30 += 2 * fixingsAlong(leftH, 0.25);
    if (edges.right) fix30 += 2 * fixingsAlong(rightH, 0.25);
  } else {
    if (edges.top)    fix30 += fixingsAlong(topRun, 0.5);
    if (edges.bottom) fix30 += fixingsAlong(W, 0.5);
    if (edges.left)   fix30 += 2 * fixingsAlong(leftH, 0.25);
    if (edges.right)  fix30 += 2 * fixingsAlong(rightH, 0.25);
  }
  if (inp.headFlash) fix30 += 2 * fixingsAlong(topRun, 0.5);

  let fix16 = 0, p2pNote = "", p2pEnhanced = false;
  if (orient === "vertical") {
    const joints = Math.max(0, panelsAcross - 1);
    if (!cfg.hasZFlash && type === 78 && Hin > 5.0 + 1e-9 && profile === "standard") {
      for (let j = 0; j < joints; j++) { const sp = j < 2 ? 0.5 : j < 4 ? 0.75 : 1.0; fix16 += fixingsAlong(Hin, sp); }
      p2pNote = "P78 vertical > 5.0 m: enhanced pattern."; p2pEnhanced = true;
    } else if (profile === "standard") {
      fix16 = joints * fixingsAlong(Hin, 1.0); p2pNote = "Joints @1000mm, 1 face.";
    } else {
      for (let j = 0; j < joints; j++) fix16 += fixingsAlong(Math.max(stripHeights[j] || 0, stripHeights[j + 1] || 0), 1.0);
      p2pNote = "Joints @ 1000 mm, sized to local height.";
    }
  } else {
    const rowJoints = Math.max(0, rows - 1);
    const engagedDouble = engaged && maxH > 6.0 + 1e-9;
    const faceMult = !engaged && !isStackedShaft && horiz.horizFix > 1 ? 2 : engagedDouble ? 2 : 1;
    fix16 = rowJoints * fixingsAlong(W, 1.0) * faceMult;
    p2pNote = engagedDouble ? "Horiz joints @1000mm, 2/side (fully engaged, above 6m)." : engaged ? "Horiz joints @1000mm, 1/side." : `Horiz joints @1000mm, ${horiz.horizFix} fixing${horiz.horizFix > 1 ? "s" : ""} each face.`;
  }

  return { fix30, fix16, p2pNote, p2pEnhanced };
}

/** Result of Shaft wall's vertical-track/floors/slab-pass calculations (see estimate_shaft_wall.md). */
interface ShaftResult {
  floors: number;
  vertTrackSection: string; vertTrackFixPerCourse: 1 | 2; vertTrackOutsideTable: boolean;
  vertTrackLM: number; vertTrackPieces: number;
  vertTrackScrews: number;
  slabAnchors: number;
  slabPassSausages: number; slabPassSealantBoxes: number;
  stripPieces: number; stripLM: number;
}

/**
 * Step 6b (Shaft wall only, see estimate_shaft_wall.md): vertical track sizing
 * (by floor height F, not width/height), floors count, vertical-track screws,
 * slab-pass sealant runs, protection strip, and the informational slab-anchor
 * count. Kept separate from computeFixings/computeTrackLM since none of this
 * is edge-driven the way the other systems' track/screw logic is -- it's
 * entirely floors/floor-height driven.
 */
function computeShaftVerticals(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[], notes: string[]): ShaftResult | null {
  const F = parseFloat(inp.floorHeight || "") || 0;
  if (F <= 0) { warnings.push("Enter a floor height to size the vertical track."); return null; }
  if (F > SHAFT_MAX_F + 1e-9) warnings.push(`Floor height exceeds the ${SHAFT_MAX_F} m limit. Contact Speedpanel.`);

  const H = geo.maxH; // total shaft height
  // floors: number of slab lifts the vertical tracks pass through. Must round
  // UP (ceil), not to nearest -- a partial floor at the top still needs a full
  // slab crossing (anchor, overlap, protection strip), so rounding to nearest
  // would silently under-count materials whenever H isn't an exact multiple
  // of F (e.g. H=10m, F=3m is 3.33 floors -- that's 4 real slab passes, not 3).
  const floors = Math.max(1, ceil(H / F));

  const track = pickShaftVerticalTrack(F);
  if (track.outsideTable) notes.push(`Floor height exceeds the standard vertical track table. Minimum section selected conservatively as ${track.section} -- confirm with Speedpanel.`);

  // "Buy each vertical length 100 mm longer than the floor lift" -- the +0.1 m
  // per floor is the overlap where tracks pass each slab. Both edges -> x2.
  const vertTrackLM = r2(2 * (H + 0.1 * floors));
  const vertTrackPieces = ceil(vertTrackLM / cfg.stocks[cfg.stocks.length - 1]);

  // Panel-to-track screws, both faces, both vertical edges: (H/0.25) x 4,
  // doubled again if the floor-height table calls for 2 screws/course.
  // NOTE: this follows estimate_shaft_wall.md section 4's formula text exactly.
  // The doc's own worked example (section 5) shows 960 for a 15 m/3 m-floor
  // shaft, which is 4x this formula's 240 -- flagged to the user as a doc
  // inconsistency; use section 4 until confirmed otherwise.
  let vertTrackScrews = ceil(H / PANEL_WIDTH) * 4;
  if (track.fixPerCourse === 2) vertTrackScrews *= 2;

  // Slab-edge anchors: informational only, "by others" -- not a Speedpanel part.
  const slabAnchors = 2 * floors;

  // Slab-pass sealant: "a run at each slab pass" -- a linear seam at each floor
  // crossing, not a panel area, so (like Corner wall's corner seam) it's
  // treated as a 1 m-wide strip at the same rate as the rest of the app:
  // sausages = ceil((W x floors) / cfg.sealantRate). Using W (the seam runs
  // across the wall width at each slab) x number of slab passes.
  const W = geo.W;
  const slabPassSausages = Math.ceil((W * floors) / cfg.sealantRate);
  const slabPassSealantBoxes = slabPassSausages > 0 ? ceil(slabPassSausages / cfg.sealantPerBox) : 0;

  // Protection strip: "one length at each slab pass and junction" -- floors-
  // driven (one per floor lift), each cut to the wall width W, not the
  // H-driven head-only strip the other systems use.
  const stripLM = r2(W * floors);
  const stripPieces = ceil(stripLM / cfg.flashStock);

  return {
    floors,
    vertTrackSection: track.section, vertTrackFixPerCourse: track.fixPerCourse, vertTrackOutsideTable: track.outsideTable,
    vertTrackLM, vertTrackPieces, vertTrackScrews,
    slabAnchors, slabPassSausages, slabPassSealantBoxes,
    stripPieces, stripLM,
  };
}

/** Step 7: per-length custom panel schedule for non-standard profiles (rake/gable), collapsed to a forced length if set. */
function buildCustomSchedule(inp: WallInput, geo: Geometry, pieces: number[], packSize: number, forced: number | null): CustomScheduleEntry[] | null {
  const { orient, profile } = inp;
  const { Hin, panelsAcross, stripHeights } = geo;
  let customSchedule: CustomScheduleEntry[] | null = null;

  if (orient === "vertical" && profile === "gable")
    customSchedule = computeGableSchedule(stripHeights.length ? stripHeights : Array(panelsAcross).fill(Hin), packSize);
  else if (orient === "vertical" && profile !== "standard")
    customSchedule = computeCustomSchedule(stripHeights.length ? stripHeights : Array(panelsAcross).fill(Hin), packSize);
  else if (orient === "horizontal" && profile !== "standard")
    customSchedule = computeCustomSchedule(pieces.slice(), packSize);

  // If a fixed stock length is selected, collapse customSchedule to that one length
  if (customSchedule && forced) {
    const totalQty = customSchedule.reduce((a, s) => a + s.qty, 0);
    const packs = Math.ceil(totalQty / packSize);
    customSchedule = [{ mm: Math.round(forced * 1000), qty: totalQty, packs, ordered: packs * packSize }];
  }

  return customSchedule;
}

/** Step 8 (external systems only): build the raw packed-panel result used by the project aggregate. */
function buildExtResult(rawCut: RawPack, packSize: number): ExtResult | null {
  if (!Array.isArray((rawCut as RawPackSuccess).groups) || !(rawCut as RawPackSuccess).totalPanels) return null;
  const success = rawCut as RawPackSuccess;
  const groups: PanelGroup[] = success.groups.map(g => {
    const pks = ceil(g.pieces / packSize);
    const ord = pks * packSize;
    return { ...g, label: `${r1(g.stock)} m`, packs: pks, ordered: ord, spare: ord - g.pieces };
  });
  const spareLM = groups.reduce((a, g) => a + g.spare * g.stock, 0);
  const deliveredLM = groups.reduce((a, g) => a + g.ordered * g.stock, 0);
  return {
    groups,
    panels: groups.reduce((a, g) => a + g.pieces, 0),
    packs: groups.reduce((a, g) => a + g.packs, 0),
    ordered: groups.reduce((a, g) => a + g.ordered, 0),
    spare: groups.reduce((a, g) => a + g.spare, 0),
    wastePct: r1(orderWastePct(success.waste, spareLM, deliveredLM)),
    usedLM: success.usedLM, waste: success.waste + spareLM,
  };
}

/** Orchestrator: runs the steps above in order, returning early the moment any step exits. */
function computeWall(rawInp: WallInput, cfg: SystemConfig): ComputeOut {
  // "Standard wall" horizontal system (see estimate_single_wall.md): a straight
  // wall restrained on all four sides is the defining assumption of the whole
  // spec, so it isn't a user-facing toggle here -- force all edges on rather
  // than trust inp.edges, which may carry a stale partial-restraint selection
  // left over from switching wallSystem or orientation. "Fully engaged S-to-S"
  // is a separate concept the doc doesn't cover, so it's forced off too --
  // otherwise a toggle left on from another wallSystem would combine with
  // Standard wall's fixed C-track section in an unspecified way.
  //
  // "Corner wall" (see estimate_free_corner_wall.md): each run has head+base
  // track plus one supported side (C-track); the free-corner side gets no
  // track/screws/sealant of its own -- that's covered once per pair by the
  // corner kit (computeCornerPair), not per-run. cornerSide picks which side
  // edge is excluded; fullyEngaged is forced off for the same reason as above.
  //
  // Both are Internal-only (!cfg.hasZFlash) -- confirmed scope. Without this
  // check, selecting Standard/Corner wall on the External calculator would
  // silently apply these Internal-specific rules there too, since wallSystem
  // itself doesn't encode internal/external.
  let inp: WallInput = rawInp;
  if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "standard") {
    inp = { ...rawInp, edges: { top: true, bottom: true, left: true, right: true }, fullyEngaged: false };
  } else if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "corner") {
    const cornerSide = rawInp.cornerSide ?? "right";
    inp = {
      ...rawInp,
      edges: { top: true, bottom: true, left: cornerSide !== "left", right: cornerSide !== "right" },
      fullyEngaged: false,
    };
  } else if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "shaft") {
    // "Shaft wall" (see estimate_shaft_wall.md): always the 78 mm panel (per
    // user decision, forced regardless of the wall's own type field), all four
    // edges restrained (head, base, both vertical tracks), fullyEngaged forced
    // off for the same reason as Standard/Corner wall.
    inp = { ...rawInp, type: 78, edges: { top: true, bottom: true, left: true, right: true }, fullyEngaged: false };
  }

  const { orient, type, profile } = inp;
  const W = parseFloat(inp.width) || 0;
  if (W <= 0) return { empty: true, warnings: [], notes: [] };

  const geo = resolveGeometry(inp, W);
  if (geo.maxH <= 1e-9) return { empty: true, warnings: ["Wall height must be greater than zero."], notes: [] };

  const { warnings, notes } = geometryNotes(inp, geo, cfg);

  const span = validateSpan(inp, geo, cfg, warnings, notes);
  if (span.exit) return span.exit;
  const { steel, isStackedShaft } = span;

  const forced = inp.forcedStock ? parseFloat(inp.forcedStock) : null;
  const piecesResult = buildPieces(inp, geo, cfg, steel, forced, warnings, notes);
  if (piecesResult.exit) return piecesResult.exit;
  const { pieces, rows } = piecesResult;

  // allowLong suppresses the packPanels 6.0 m hard-cap for cases where pieces can
  // legitimately exceed 6.0 m stock: non-standard profiles (strip heights taper and
  // may be passed to customSchedule, not packPanels) and stacked/shaft horizontal.
  // Steel + standard vertical is excluded here because buildPieces pre-splits those
  // strips at the 6.0 m boundary, so all pieces are already <= 6.0 m before packPanels.
  const allowLong = profile !== "standard" || isStackedShaft;
  const rawCut = packPanels(pieces, forced, cfg.stocks, allowLong);
  const packSize = cfg.packSizeFn(type);
  const chosen = buildOption(rawCut, type);
  if (rawCut.exceeds) warnings.push("Panel exceeds max stock length. Contact Speedpanel.");
  else if (rawCut.tooShort) warnings.push(`Selected length ${r1(forced!)} m is shorter than the longest panel needed.`);
  if (orient === "horizontal" && profile !== "standard") notes.push("Horizontal raked/gable rows are sized to the widest point within each 250 mm row band.");

  const { cLM, jLM, zLM } = computeTrackLM(inp, geo, cfg, warnings);
  const cStock = orient === "horizontal" ? HORIZ_CTRACK_STOCK : cfg.ctrackStockFn(type);
  const cPieces = cLM > 0 ? ceil(cLM / cStock) : 0;
  const jPieces = jLM > 0 ? ceil(jLM / cfg.jtrackStock[0]) : 0;
  const zPieces = zLM > 0 ? ceil(zLM / EXT_ZFLASH_STOCK) : 0;

  const horiz = computeHorizCtrack(inp, geo, cfg, isStackedShaft, notes, warnings);

  const sausages = geo.area > 0 ? Math.ceil(geo.area / cfg.sealantRate) : 0;
  const sealantBoxes = sausages > 0 ? ceil(sausages / cfg.sealantPerBox) : 0;

  // Shaft wall's own protection strip (one length per slab pass + junction,
  // see estimate_shaft_wall.md) replaces the generic head-only strip the other
  // systems use -- so flashLM/flashPieces are suppressed here (headFlash
  // toggle is ignored for Shaft wall; the strip is inherent to the system, not
  // an optional extra).
  const isShaft = !cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft";
  const externalHorizontalCoverLM = cfg.hasZFlash && orient === "horizontal"
    ? horizontalJointCoverLM(profile, rows, geo.W, geo.leftH, geo.rightH, geo.apex, geo.apexX)
    : 0;
  const flashLM = cfg.hasZFlash && orient === "horizontal"
    ? externalHorizontalCoverLM
    : (inp.headFlash && !isShaft) ? geo.topRun : 0;
  const flashPieces = flashLM > 0 ? ceil(flashLM / cfg.flashStock) : 0;

  const { fix30: fix30Base, fix16, p2pNote, p2pEnhanced } = computeFixings(inp, geo, cfg, rows, isStackedShaft, horiz);

  const shaftResult = isShaft ? computeShaftVerticals(inp, geo, cfg, warnings, notes) : null;
  // Shaft wall's fix30 is entirely the vertical-track screw count (computeFixings
  // returns 0 for it, since that formula needs floors/floor-height it doesn't have).
  const fix30 = shaftResult ? shaftResult.vertTrackScrews : fix30Base;

  const customSchedule = buildCustomSchedule(inp, geo, pieces, packSize, forced);
  const extResult = cfg.hasZFlash ? buildExtResult(rawCut, packSize) : null;

  return {
    empty: false, orient, panelsAcross: geo.panelsAcross, area: r2(geo.area), acrossCount: pieces.length,
    chosen: cfg.hasZFlash ? undefined : chosen,
    result: cfg.hasZFlash ? (extResult ?? undefined) : undefined,
    cLM: r2(cLM), cStock, cPieces, jLM: r2(jLM), jPieces, zLM: r2(zLM), zPieces,
    horizProfile: horiz.horizProfile, horizFix: horiz.horizFix,
    ctrackDim: cfg.ctrackDimFn(type, orient === "horizontal" ? horiz.horizProfile : null),
    jtrackDim: cfg.jtrackDimFn(type),
    flashDim: cfg.hasZFlash && orient === "horizontal" ? EXT_HORIZ_COVER_DIM : FLASH_DIM, flashLM: r2(flashLM), flashPieces,
    fix30, fix16, boxes30: boxesOf(fix30), boxes16: boxesOf(fix16),
    sausages, sealantBoxes, p2pNote, p2pEnhanced,
    warnings, notes, maxH: r2(geo.maxH), customSchedule, rows, pieces,
    ...(shaftResult ? {
      floors: shaftResult.floors,
      vertTrackSection: shaftResult.vertTrackSection,
      vertTrackFixPerCourse: shaftResult.vertTrackFixPerCourse,
      vertTrackOutsideTable: shaftResult.vertTrackOutsideTable,
      vertTrackLM: shaftResult.vertTrackLM,
      vertTrackPieces: shaftResult.vertTrackPieces,
      slabAnchors: shaftResult.slabAnchors,
      slabPassSausages: shaftResult.slabPassSausages,
      slabPassSealantBoxes: shaftResult.slabPassSealantBoxes,
      stripPieces: shaftResult.stripPieces,
      stripLM: shaftResult.stripLM,
    } : {}),
  };
}

// --- Corner pair (Corner wall system) -----------------------------------------
// The "corner kit" added once per linked pair of Corner wall runs (see
// estimate_free_corner_wall.md Part 2): the corner post itself, corner screws,
// corner seam sealant, and the corner protection strip. Computed from the two
// linked walls' raw inputs (not their ComputeOut) since the post table needs
// each run's W and the pair's shared H directly.
interface CornerPairResult {
  section: string; fixPerCourse: 1 | 2; outsideTable: boolean;
  postLM: number; postPieces: number; postStock: number;
  cornerScrews: number; cornerScrewBoxes: number;
  cornerSausages: number; cornerSealantBoxes: number;
  stripLM: number; stripPieces: number;
  H: number; heightMismatch: boolean;
  warnings: string[]; notes: string[];
}

function computeCornerPair(wallA: Wall, wallB: Wall, cfg: SystemConfig): CornerPairResult | null {
  const Ha = parseFloat(wallA.height) || 0, Hb = parseFloat(wallB.height) || 0;
  const Wa = parseFloat(wallA.width) || 0, Wb = parseFloat(wallB.width) || 0;
  if (Ha <= 0 || Wa <= 0 || Wb <= 0) return null;

  const warnings: string[] = [], notes: string[] = [];
  const heightMismatch = Hb > 0 && Math.abs(Ha - Hb) > 1e-9;
  if (heightMismatch) warnings.push(`Linked runs have different heights (${r2(Ha)} m vs ${r2(Hb)} m) -- corner post sized to ${wallA.name}'s height. Confirm on site.`);
  const H = Ha; // per user decision: assume equal heights, use the first run's height

  // Corner post is sized to whichever run needs the more conservative post (see
  // user decision: always step up to the larger/thicker of the two runs' own
  // lookups). "More conservative" is compared numerically as a tuple of
  // (fixPerCourse, BMT, leg, depth) -- fixPerCourse first since 2 screws/course
  // is a stronger signal than section size, then the section's three numbers
  // parsed from "depth x leg x BMT" (thickest/deepest wins on a tie). This is
  // NOT a string comparison -- "90 x 84 x 1.95" vs "90 x 83 x 1.50" must be
  // compared by actual parsed magnitude, not lexicographic order, since e.g.
  // BMT "1.5" vs "1.15" would sort wrong as strings ("1.15" > "1.5" lexically).
  const pa = pickCornerPost(wallA.type, Wa, H);
  const pb = pickCornerPost(wallB.type, Wb, H);
  if (!pa && !pb) return null;
  const moreConservative = (x: CornerPostResult, y: CornerPostResult): CornerPostResult => {
    if (x.fixPerCourse !== y.fixPerCourse) return x.fixPerCourse > y.fixPerCourse ? x : y;
    const [xDepth, xLeg, xBmt] = x.section.split(" x ").map(Number);
    const [yDepth, yLeg, yBmt] = y.section.split(" x ").map(Number);
    if (xBmt !== yBmt) return xBmt > yBmt ? x : y;
    if (xLeg !== yLeg) return xLeg > yLeg ? x : y;
    return xDepth >= yDepth ? x : y;
  };
  let picked = pa && pb ? moreConservative(pa, pb) : (pa ?? pb)!;
  if (picked.outsideTable) notes.push(`Corner post size outside the standard table -- conservatively selected as ${picked.section}. Confirm with Speedpanel.`);

  const postStock = HORIZ_CTRACK_STOCK;
  const postLM = r2(H);
  const postPieces = ceil(postLM / postStock);

  const courses = ceil(H / PANEL_WIDTH);
  const cornerScrews = courses * picked.fixPerCourse * 2; // both sides of the post
  const cornerScrewBoxes = boxesOf(cornerScrews);

  // Corner seam sealant: a linear seam down both faces, not a panel area, so it
  // doesn't fit cfg.sealantRate's m2/sausage convention directly. Per user
  // decision, treated as a 1 m-wide strip at the same rate as the rest of the
  // app: sausages = ceil((2 x H x 1) / cfg.sealantRate).
  const cornerSausages = Math.ceil((2 * H) / cfg.sealantRate);
  const cornerSealantBoxes = cornerSausages > 0 ? ceil(cornerSausages / cfg.sealantPerBox) : 0;

  const stripLM = r2(H);
  const stripPieces = ceil(stripLM / cfg.flashStock);

  return {
    section: picked.section, fixPerCourse: picked.fixPerCourse, outsideTable: picked.outsideTable,
    postLM, postPieces, postStock,
    cornerScrews, cornerScrewBoxes,
    cornerSausages, cornerSealantBoxes,
    stripLM, stripPieces,
    H, heightMismatch, warnings, notes,
  };
}

// --- Shaft pair (Shaft wall system) --------------------------------------------
// The back-to-back C-track junction shared between a primary and secondary
// split stack wall (see estimate_shaft_wall.md and user clarification -- the
// junction itself isn't named in the doc, but follows the same length/sizing
// convention as the vertical tracks: sized by floor height F, length
// 2x(H+0.1xfloors) since it's two tracks screwed back-to-back). Screws at the
// junction use the same per-edge rate as one vertical track edge.
interface ShaftPairResult {
  section: string; fixPerCourse: 1 | 2; outsideTable: boolean;
  junctionLM: number; junctionPieces: number; junctionStock: number;
  junctionScrews: number; junctionScrewBoxes: number;
  H: number; floors: number; heightMismatch: boolean;
  warnings: string[]; notes: string[];
}

function computeShaftPair(wallA: Wall, wallB: Wall, cfg: SystemConfig): ShaftPairResult | null {
  const Ha = parseFloat(wallA.height) || 0, Hb = parseFloat(wallB.height) || 0;
  const Fa = parseFloat(wallA.floorHeight || "") || 0, Fb = parseFloat(wallB.floorHeight || "") || 0;
  if (Ha <= 0 || Fa <= 0) return null;

  const warnings: string[] = [], notes: string[] = [];
  const heightMismatch = Hb > 0 && Math.abs(Ha - Hb) > 1e-9;
  if (heightMismatch) warnings.push(`Linked stack walls have different total heights (${r2(Ha)} m vs ${r2(Hb)} m) -- junction sized to ${wallA.name}'s height. Confirm on site.`);
  const H = Ha; // per the same convention as Corner wall: assume equal, use the first wall's height
  // See computeShaftVerticals for why this must be ceil, not round.
  const floors = Math.max(1, ceil(H / Fa));

  // Junction track section: more conservative of the two walls' own floor-
  // height lookups (same tie-break approach as computeCornerPair's post pick).
  const ta = pickShaftVerticalTrack(Fa);
  const tb = Fb > 0 ? pickShaftVerticalTrack(Fb) : null;
  const moreConservative = (x: ShaftTrackResult, y: ShaftTrackResult): ShaftTrackResult => {
    if (x.fixPerCourse !== y.fixPerCourse) return x.fixPerCourse > y.fixPerCourse ? x : y;
    const [xDepth, xLeg, xBmt] = x.section.split(" x ").map(Number);
    const [yDepth, yLeg, yBmt] = y.section.split(" x ").map(Number);
    if (xBmt !== yBmt) return xBmt > yBmt ? x : y;
    if (xLeg !== yLeg) return xLeg > yLeg ? x : y;
    return xDepth >= yDepth ? x : y;
  };
  const picked = tb ? moreConservative(ta, tb) : ta;
  if (picked.outsideTable) notes.push(`Junction track floor height exceeds the standard table -- conservatively selected as ${picked.section}. Confirm with Speedpanel.`);

  const junctionStock = HORIZ_CTRACK_STOCK;
  const junctionLM = r2(2 * (H + 0.1 * floors));
  const junctionPieces = ceil(junctionLM / junctionStock);

  let junctionScrews = ceil(H / PANEL_WIDTH) * 2; // one edge's worth, both faces
  if (picked.fixPerCourse === 2) junctionScrews *= 2;
  const junctionScrewBoxes = boxesOf(junctionScrews);

  return {
    section: picked.section, fixPerCourse: picked.fixPerCourse, outsideTable: picked.outsideTable,
    junctionLM, junctionPieces, junctionStock,
    junctionScrews, junctionScrewBoxes,
    H, floors, heightMismatch, warnings, notes,
  };
}


// Thin wrappers -- single call site, config-driven
const compute         = (inp: WallInput): ComputeOut => computeWall(inp, INT_CONFIG);
const computeExternal = (inp: WallInput): ComputeOut => computeWall(inp, EXT_CONFIG);

// --- Internal aggregate -------------------------------------------------------
interface PanelMapEntry { type: number; stock: number; pieces: number; }
interface CTrackMapEntry { type: number; orient: string; stock: number; lm: number; horizProfile: string | null; horizFix: number; }
interface CTrackAggEntry extends CTrackMapEntry { pieces: number; } // post-aggregate: lm is rounded, pieces computed
interface CustomMapEntry { type: number; mm: number; qty: number; }
// aggregate() output shapes (used in JSX render maps)
interface AggPanelEntry extends PanelGroup { type: number; }
interface AggCustomEntry { type: number; mm: number; qty: number; packs: number; ordered: number; spare: number; packSize: number; }
// buildExtProjAgg group output
interface ExtAggGroup { stock: number; pieces: number; packs: number; ordered: number; spare: number; }

function aggregate(results: WallResult[], cfg: SystemConfig = INT_CONFIG) {
  const pm: Record<string, PanelMapEntry> = {}, ct: Record<string, CTrackMapEntry> = {}, cm: Record<string, CustomMapEntry> = {};
  let f30 = 0, f16 = 0, flLM = 0, jLM = 0, offcut = 0, usedLM = 0, ta = 0, sus = 0;
  // Shaft wall per-wall vertical-track / slab-pass items (each wall's own
  // ComputeOut already has these computed -- just need summing here, same as
  // fix30/fix16/flashLM/etc. above).
  let vertLM = 0, slabAnchors = 0, slabSausages = 0, stripLM = 0;
  for (const { wall: w, out: o } of results) {
    if (o.empty || !o.chosen || o.chosen.invalid) continue;
    ta += parseFloat(String(o.area)) || 0;
    f30 += o.fix30 || 0; f16 += o.fix16 || 0; flLM += o.flashLM || 0; jLM += o.jLM || 0; sus += o.sausages || 0;
    vertLM += o.vertTrackLM || 0; slabAnchors += o.slabAnchors || 0; slabSausages += o.slabPassSausages || 0; stripLM += o.stripLM || 0;
    const ctKey = `${w.type}|${o.orient}`;
    if (!ct[ctKey]) ct[ctKey] = { type: w.type, orient: o.orient || "", stock: o.cStock || 0, lm: 0, horizProfile: null, horizFix: 1 };
    ct[ctKey].lm += o.cLM || 0;
    if (o.orient === "horizontal" && o.horizProfile) {
      const cur = ct[ctKey].horizProfile;
      if (!cur || (o.horizFix || 0) > ct[ctKey].horizFix || ((o.horizFix || 0) === ct[ctKey].horizFix && o.horizProfile > cur))
        { ct[ctKey].horizProfile = o.horizProfile; ct[ctKey].horizFix = o.horizFix ?? 1; }
    }
    if (o.customSchedule && o.customSchedule.length > 0) {
      for (const s of o.customSchedule) { const k = `${w.type}|${s.mm}`; cm[k] = cm[k] || { type: w.type, mm: s.mm, qty: 0 }; cm[k].qty += s.qty; }
    } else {
      // When a forced stock length is set, collapse all groups from this wall into
      // that single length for the aggregate -- the packer may split pieces across
      // multiple bins but the order should be placed entirely at the forced length.
      const forcedM = w.forcedStock ? parseFloat(w.forcedStock) : null;
      if (forcedM) {
        const totalPieces = o.chosen.groups.reduce((a, g) => a + g.pieces, 0);
        const k = `${w.type}|${forcedM}`;
        pm[k] = pm[k] || { type: w.type, stock: forcedM, pieces: 0 };
        pm[k].pieces += totalPieces;
      } else {
        for (const g of o.chosen.groups) { const k = `${w.type}|${g.stock}`; pm[k] = pm[k] || { type: w.type, stock: g.stock, pieces: 0 }; pm[k].pieces += g.pieces; }
      }
    }
    offcut += o.chosen.offcut || 0; usedLM += o.chosen.usedLM || 0;
  }

  // Corner-post and Shaft-junction kits are shared between exactly two linked
  // walls, so each pair must be counted once -- not once per wall in the pair.
  // Walk each wall once; only compute the pair's kit the first time either of
  // its two members is encountered, tracked via seenPairIds so the partner
  // isn't double-counted when its own turn comes up in the loop.
  let postScrews = 0, postScrewBoxes = 0, postLM = 0, cornerSausages2 = 0, cornerSealantBoxes2 = 0, postStripLM = 0;
  let junctionScrews2 = 0, junctionScrewBoxes2 = 0, junctionLM2 = 0;
  const seenCornerPairIds = new Set<number>(), seenShaftPairIds = new Set<number>();
  for (const { wall: w } of results) {
    if (w.wallSystem === "corner" && w.cornerPartnerId != null && !seenCornerPairIds.has(w.id) && !seenCornerPairIds.has(w.cornerPartnerId)) {
      const partner = results.find(r => r.wall.id === w.cornerPartnerId)?.wall;
      if (partner) {
        const kit = computeCornerPair(w, partner, cfg);
        if (kit) {
          postLM += kit.postLM; // raw required length -- pieces/ordered are derived below from the summed LM, same convention as vertTrackLM
          postScrews += kit.cornerScrews; postScrewBoxes += kit.cornerScrewBoxes;
          cornerSausages2 += kit.cornerSausages; cornerSealantBoxes2 += kit.cornerSealantBoxes;
          postStripLM += kit.stripLM;
        }
      }
      seenCornerPairIds.add(w.id);
    }
    if (w.wallSystem === "shaft" && w.shaftPartnerId != null && !seenShaftPairIds.has(w.id) && !seenShaftPairIds.has(w.shaftPartnerId)) {
      const partner = results.find(r => r.wall.id === w.shaftPartnerId)?.wall;
      if (partner) {
        const kit = computeShaftPair(w, partner, cfg);
        if (kit) {
          junctionLM2 += kit.junctionLM;
          junctionScrews2 += kit.junctionScrews; junctionScrewBoxes2 += kit.junctionScrewBoxes;
        }
      }
      seenShaftPairIds.add(w.id);
    }
  }

  const panels = Object.values(pm).map(p => ({ ...p, label: `${r1(p.stock)} m`, ...packInfo(p.pieces, p.type) })).sort((a, b) => a.type - b.type || a.stock - b.stock);
  const customPanels = Object.values(cm).sort((a, b) => a.type - b.type || a.mm - b.mm).map(({ type, mm, qty }) => {
    const packSize = PACK[type]; const packs = Math.ceil(qty / packSize); const ordered = packs * packSize;
    return { type, mm, qty, packs, ordered, spare: ordered - qty, packSize };
  });
  const cTracks = Object.values(ct).map(({ type, orient, stock, lm, horizProfile, horizFix }) => ({
    type, orient, lm: r2(lm), stock, pieces: lm > 0 ? ceil(lm / stock) : 0, horizProfile, horizFix
  })).filter(c => c.lm > 0).sort((a, b) => a.type - b.type || (a.orient > b.orient ? 1 : -1));
  let sp = 0, dl = 0;
  for (const p of panels) { sp += p.spare * p.stock; dl += p.ordered * p.stock; }
  for (const p of customPanels) { const stock = p.mm / 1000; sp += p.spare * stock; dl += p.ordered * stock; }
  const jLMr = r2(jLM), flLMr = r2(flLM);
  const vertLMr = r2(vertLM), stripLMr = r2(stripLM + postStripLM);
  const totalPostScrews = postScrews, totalJunctionScrews = junctionScrews2;
  return {
    panels, customPanels, cTracks, offcut: r2(offcut), spareLen: r2(sp), deliveredLen: r2(dl), usedLM,
    wastePct: orderWastePct(offcut, sp, dl),
    jLM: jLMr, jPieces: jLMr > 0 ? ceil(jLMr / JTRACK_STOCK[0]) : 0,
    flashLM: flLMr, flashPieces: flLMr > 0 ? ceil(flLMr / FLASH_STOCK) : 0,
    fix30: f30 + totalPostScrews + totalJunctionScrews, fix16: f16,
    boxes30: boxesOf(f30 + totalPostScrews + totalJunctionScrews), boxes16: boxesOf(f16),
    totalPanels: panels.reduce((a, p) => a + p.pieces, 0) + customPanels.reduce((a, s) => a + s.qty, 0),
    totalPacks: panels.reduce((a, p) => a + p.packs, 0) + customPanels.reduce((a, s) => a + s.packs, 0),
    totalArea: r2(ta), sausages: sus + cornerSausages2, sealantBoxes: (sus + cornerSausages2) > 0 ? Math.ceil((sus + cornerSausages2) / SEALANT_PER_BOX) : 0,
    // Shaft wall project totals (vertical track LM already includes per-wall
    // vertical tracks; junction LM/screws from linked pairs are separate since
    // they use a possibly-different section and aren't part of any one wall's
    // own vertTrackLM).
    vertTrackLM: vertLMr, vertTrackPieces: vertLMr > 0 ? ceil(vertLMr / HORIZ_CTRACK_STOCK) : 0,
    slabAnchors, slabPassSausages: slabSausages, slabPassSealantBoxes: slabSausages > 0 ? ceil(slabSausages / SEALANT_PER_BOX) : 0,
    stripLM: stripLMr, stripPieces: stripLMr > 0 ? ceil(stripLMr / FLASH_STOCK) : 0,
    junctionLM: r2(junctionLM2), junctionPieces: junctionLM2 > 0 ? ceil(junctionLM2 / HORIZ_CTRACK_STOCK) : 0,
    junctionScrews: junctionScrews2, junctionScrewBoxes: junctionScrewBoxes2,
    // Corner post project totals
    cornerPostLM: r2(postLM), cornerPostPieces: postLM > 0 ? ceil(postLM / HORIZ_CTRACK_STOCK) : 0,
    cornerScrews: postScrews, cornerScrewBoxes: postScrewBoxes,
  };
}

// --- External project aggregate -----------------------------------------------
interface ExtPanelMapEntry { stock: number; pieces: number; }

const buildExtProjAgg = (wallResults: WallResult[]) => {
  let totalArea = 0, fix30 = 0, fix16 = 0, sausages = 0, cLM = 0, jLM = 0, zLM = 0, flashLM = 0;
  const panelMap: Record<number, ExtPanelMapEntry> = {};
  for (const { wall: w, out: o } of wallResults) {
    if (o.empty || !o.result) continue;
    totalArea += parseFloat(String(o.area)) || 0;
    fix30 += o.fix30 || 0; fix16 += o.fix16 || 0; sausages += o.sausages || 0;
    cLM += o.cLM || 0; jLM += o.jLM || 0; zLM += o.zLM || 0; flashLM += o.flashLM || 0;
    const forcedM = w.forcedStock ? parseFloat(w.forcedStock) : null;
    if (forcedM) {
      const totalPieces = o.result.groups.reduce((a, g) => a + g.pieces, 0);
      panelMap[forcedM] = panelMap[forcedM] || { stock: forcedM, pieces: 0 };
      panelMap[forcedM].pieces += totalPieces;
    } else {
      for (const g of o.result.groups) { panelMap[g.stock] = panelMap[g.stock] || { stock: g.stock, pieces: 0 }; panelMap[g.stock].pieces += g.pieces; }
    }
  }
  const groups = Object.values(panelMap)
    .sort((a, b) => a.stock - b.stock)
    .map(g => {
      const pks = ceil(g.pieces / EXT_PACK);
      const ord = pks * EXT_PACK;
      return { ...g, packs: pks, ordered: ord, spare: ord - g.pieces };
    });
  const sealantBoxes = sausages > 0 ? ceil(sausages / EXT_SEALANT_PER_BOX) : 0;
  const cLMr = r2(cLM), jLMr = r2(jLM), zLMr = r2(zLM), flashLMr = r2(flashLM);
  return {
    groups, panels: groups.reduce((a, g) => a + g.pieces, 0), packs: groups.reduce((a, g) => a + g.packs, 0),
    totalArea: r2(totalArea), fix30, fix16, boxes30: boxesOf(fix30), boxes16: boxesOf(fix16),
    sausages, sealantBoxes, cLM: cLMr, jLM: jLMr, zLM: zLMr, flashLM: flashLMr,
    cPieces: cLMr > 0 ? ceil(cLMr / EXT_CTRACK_STOCK[0]) : 0,
    jPieces: jLMr > 0 ? ceil(jLMr / EXT_JTRACK_STOCK[0]) : 0,
    zPieces: zLMr > 0 ? ceil(zLMr / EXT_ZFLASH_STOCK) : 0,
    flashPieces: flashLMr > 0 ? ceil(flashLMr / 3.0) : 0,
  };
};

// --- Locked system data -------------------------------------------------------
// INT_LOCKED / EXT_LOCKED (display-only reference tables) now live in ./data.
const DataRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-100 pb-2.5 last:border-0">
    <span className="shrink-0 text-sm font-medium text-slate-400">{k}</span>
    <span className="text-right text-sm font-semibold text-slate-700">{v}</span>
  </div>
);
const LDRow = ({ row }: { row: string[] }) =>
  row.length === 1
    ? <div className={cx.ldHead}>{row[0].replace(/-/g, "")}</div>
    : <DataRow k={row[0]} v={row[1]} />;
const LockedDataInt = () => <div className={cx.ldWrap}>{INT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;
const LockedDataExt = () => <div className={cx.ldWrap}>{EXT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;

// SPAN_TABLE_VERT / SPAN_TABLE_HORIZ and the panel TYPES list now live in ./data
// (derived from the PANELS catalog).

// --- Wall and system config ---------------------------------------------------
const SYSTEMS = [
  { id: "int-vert",  label: "Vertical",   sub: "Internal Wall", ext: false, orient: "vertical"   as const },
  { id: "int-horiz", label: "Horizontal", sub: "Internal Wall", ext: false, orient: "horizontal" as const },
  { id: "ext-vert",  label: "Vertical",   sub: "External Wall", ext: true,  orient: "vertical"   as const },
  { id: "ext-horiz", label: "Horizontal", sub: "External Wall", ext: true,  orient: "horizontal" as const },
];

// Single default-wall factory shared by both Internal and External. The colour
// fields are only read by External (Internal ignores them), but every wall
// carries them so the same wall list can be shown/computed in either mode --
// see useWallStore, which keeps one shared list across all system switches.
const defaultWall = (id: number, orient: "vertical" | "horizontal" = "vertical"): Wall => ({
  id, name: `Wall ${id}`, orient, type: 78, profile: "standard", wallSystem: "standard",
  cornerPartnerId: null, cornerSide: "right",
  floorHeight: "", shaftPartnerId: null, junctionPartnerId: null,
  width: "", height: "", leftH: "", rightH: "", eavesH: "", apexH: "", ridgeX: "",
  headFinish: "C", bottomFinish: "C", leftFinish: "C", rightFinish: "C",
  intCorners: "", extCorners: "",
  colour: "OW", colourType: "stocked",
  edges: { top: true, bottom: true, left: true, right: true },
  headFlash: true, forcedStock: "", fullyEngaged: false, steelStructure: false,
});


// --- LengthExplorer -----------------------------------------------------------
// Shows every candidate stock length with a waste bar so the user can
// instantly compare waste across all options.
const LengthExplorer = ({
  pieces, stocks, packType, currentStock, onSelect, isExt
}: {
  pieces: number[]; stocks: number[]; packType: number;
  currentStock: string; onSelect: (v: string) => void; isExt?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (!pieces || !pieces.length) return [];
    return stocks.map(s => {
      const raw = packPanels([...pieces], s, stocks, false);
      if (raw.exceeds || raw.tooShort) return null;
      const result = buildOption(raw, packType);
      const panels = result.panels ?? 1;
      const offcutPerPanel = panels > 0 ? (result.offcut ?? 0) / panels : 0;
      // % of the stock length that is cut off each panel
      const offcutPct = s > 0 ? Math.round((offcutPerPanel / s) * 1000) / 10 : 0;
      return {
        stock: s,
        label: `${r1(s)} m`,
        panels: result.panels,
        packs: result.packs,
        ordered: result.orderedInPacks,
        offcutPct,
        isSelected: currentStock === String(s),
      };
    }).filter(Boolean);
  }, [pieces, stocks, packType, currentStock]);

  const autoRaw = useMemo(() => {
    if (!pieces || !pieces.length) return null;
    const raw = packPanels([...pieces], null, stocks, false);
    if (raw.exceeds || !raw.groups || !raw.groups.length) return null;
    return buildOption(raw, packType);
  }, [pieces, stocks, packType]);

  const selectedOption = options.find(o => o && o.isSelected);
  const autoSelected = !currentStock;

  const headerLabel = autoSelected
    ? "Length: automatic"
    : selectedOption
      ? `Length: ${selectedOption.label}`
      : "Length: automatic";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 bg-blue-50/60 transition-colors hover:bg-blue-100/70"
      >
        <span style={{ color: autoSelected ? "#94a3b8" : NAVY }}>{headerLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {/* Auto option */}
          <button
            onClick={() => { onSelect(""); setOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${autoSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: autoSelected ? BLUE : NAVY }}>
                {autoSelected && "✓ "}Automatic
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {autoRaw ? `Best fit — ${autoRaw.panels} panels, ${Math.round(((autoRaw.offcut ?? 0) / (autoRaw.panels || 1) / ((autoRaw.groups?.[0]?.stock) || 1)) * 1000) / 10}% cut/panel` : "Let the estimator choose"}
              </div>
            </div>
            {autoSelected && <div className="text-xs font-bold uppercase tracking-widest" style={{ color: BLUE }}>Selected</div>}
          </button>

          {/* Per-length options */}
          {options.map(opt => {
            if (!opt) return null;
            const isSelected = opt.isSelected;
            return (
              <button
                key={opt.stock}
                onClick={() => { onSelect(String(opt.stock)); setOpen(false); }}
                className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-bold" style={{ color: isSelected ? BLUE : NAVY }}>
                    {isSelected && "✓ "}{opt.label}
                  </span>
                  <span className="text-sm font-bold text-slate-500">{opt.offcutPct}% cut</span>
                </div>
                {/* Waste bar — wider = more cut off, scaled to 50% max */}
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, opt.offcutPct * 2)}%`, background: BLUE, opacity: 0.35 }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-slate-400">
                  {opt.panels} panels · {opt.packs} pack{opt.packs !== 1 ? "s" : ""} · {opt.ordered} ordered
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- CardGrid -------------------------------------------------------------
// On web layout, arranges its children (cards) side by side in a responsive
// grid instead of one full-width stacked column -- fixes cards stretching to
// the whole (~1000px) main column with sparse, empty-feeling rows, and keeps
// the main column from growing far taller than the sticky sidebar when
// several cards/wall breakdowns are shown at once. auto-fit/minmax means it
// gracefully drops to fewer columns (down to 1) on a narrower web viewport,
// rather than a fixed column count. On phone layout this renders children
// exactly as before (no wrapper), so phone output is byte-identical.
//
// Margin ownership: a grid container blocks normal margin collapsing at its
// boundary (unlike a plain block sibling), so relying on each child's own
// baked-in mt-3 (as every card component does, for normal block-flow
// stacking on phone) produces MORE visible gap on web than phone -- the
// preceding heading's mb-2 no longer collapses away into the child's larger
// mt-3, it just adds on top of it. Fix: the grid container itself carries
// mt-3 (so it collapses normally with whatever precedes it, exactly like a
// plain card would), gap-3 provides uniform row/column spacing, and
// [&>*]:!mt-0 neutralizes each child's own top margin so it can't ALSO
// contribute -- one spacing source instead of two independent ones.
const CardGrid = ({ layoutMode, minWidth = 320, children }: {
  layoutMode: EffectiveLayout; minWidth?: number; children: React.ReactNode;
}) => (
  layoutMode === "web"
    ? <div className="mt-3 grid gap-3 items-start [&>*]:!mt-0" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}>{children}</div>
    : <>{children}</>
);

// --- UI primitives ------------------------------------------------------------
const SectionLabel = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className={cx.sectionLbl}>
    <span style={{ color: BLUE }}>{icon}</span>{children}
  </div>
);

const Num = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type="number" inputMode="decimal" value={value}
      onChange={e => onChange(e.target.value)}
      className={`${cx.input} font-medium`} style={{ color: NAVY }} />
  </div>
);

const UnitToggle = ({ unit, setUnit }: { unit: string; setUnit: (u: string) => void }) => (
  <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-bold shadow-sm">
    {["m", "mm"].map(u => (
      <button key={u} onClick={() => setUnit(u)} className="w-11 py-2 text-center transition-all"
        style={unit === u ? { background: BLUE, color: "#fff" } : { background: "#fff", color: "#94a3b8" }}>{u}</button>
    ))}
  </div>
);

/** Animated toggle switch pill */
const ToggleSwitch = ({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) => (
  <button onClick={onToggle}
    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
    style={{ color: active ? BLUE : "#94a3b8" }}>
    <span>{label}</span>
    <span style={{
      display: "inline-flex", width: 32, height: 18, borderRadius: 9,
      background: active ? BLUE : "#cbd5e1",
      position: "relative", flexShrink: 0, transition: "background 0.2s",
    }}>
      <span style={{
        position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        left: active ? 16 : 2, transition: "left 0.2s",
      }} />
    </span>
  </button>
);

/** Three-up stats grid: m2 / panels / type */
const StatsRow = ({ area, panels, panelType }: { area: string | number; panels: string | number; panelType: string }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    <Stat value={area}      label="Total m2" />
    <Stat value={panels}    label="Panels" />
    <Stat value={panelType} label="Panel type" />
  </div>
);

/** Italic notes list shown below results */
const NotesList = ({ notes }: { notes?: string[] | null }) => {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
      {notes.map((n, i) => (
        <p key={i} className="flex gap-2 text-sm leading-relaxed text-slate-500">
          <span style={{ color: BLUE }}>›</span>{n}
        </p>
      ))}
    </div>
  );
};

/** "All N walls locked to X m" confirmation line */
const ProjectLockNote = ({ wallCount, stock, dimUnit, numM, customActive }: {
  wallCount: number; stock: string; dimUnit: string; numM?: number; customActive?: boolean;
}) => {
  const display = customActive && numM
    ? (dimUnit === "mm" ? `${Math.round(numM * 1000)} mm` : `${r1(numM)} m`)
    : `${r1(parseFloat(stock))} m`;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: BLUE }}>
      <span>›</span> All {wallCount} wall{wallCount !== 1 ? "s" : ""} locked to {display}
    </p>
  );
};

const Stat = ({ value, label }: { value: string | number; label: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-2 py-4 text-center shadow-sm" style={{ borderTop: `2px solid ${GOLD}` }}>
    <div className="text-xl font-extrabold leading-none tracking-tight" style={{ color: BLUE }}>{value}</div>
    <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
  </div>
);

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className={`mt-3 ${cx.card}`}>
    <div className={cx.cardTitle} style={{ color: NAVY }}>
      <span style={{ color: BLUE }}>{icon}</span>{title}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

const Row = ({ k, v, dim, hl }: { k: string; v: string | number; dim?: boolean; hl?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className={dim ? cx.rowKeyDim : cx.rowKey}>{k}</span>
    <span className={cx.rowVal} style={{ color: hl ? BLUE : dim ? "#cbd5e1" : NAVY }}>{v}</span>
  </div>
);

/**
 * One linear-metre material line item, e.g. "C-track perimeter -- 55x82x50"
 * with a piece count on the right and an "X m total -- stocked @ Y m" subline.
 * Used by every track/flashing card (internal + external, single wall + project).
 */
const LMLineItem = ({ label, pieces, lm, stockLabel, bordered = true }: {
  label: string; pieces: number; lm: number; stockLabel: string; bordered?: boolean;
}) => (
  <div className={bordered ? cx.rowBorder : undefined}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - {stockLabel}</div>
  </div>
);

// typeFromPackSize now lives in ./data.

/** "Head track flashing" card -- identical layout in all four track/flashing card variants. */
const HeadFlashingCard = ({ dim, pieces, lm, stock }: { dim: string; pieces: number; lm: number; stock: number }) => (
  <Card title="Head track flashing" icon={<Layers size={14} />}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500">{dim}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - stocked @ {r1(stock)} m</div>
    <Row k="Fixing layout" v="2 rows @ 500, stag. 250" dim />
  </Card>
);

/** Corner wall kit -- the shared post, corner screws, corner sealant, and corner
 * protection strip for a linked pair of runs (see estimate_free_corner_wall.md
 * Part 2). Shown identically on both linked walls. */
const CornerKitCard = ({ kit, partnerName }: { kit: CornerPairResult; partnerName: string }) => (
  <Card title="Corner kit" icon={<Frame size={14} />}>
    <p className={`mb-2 text-xs leading-relaxed text-slate-400`}>Shared with {partnerName} -- calculated once per corner.</p>
    <LMLineItem
      label={`Corner post - ${kit.section}`}
      pieces={kit.postPieces} lm={kit.postLM}
      stockLabel={`stocked @ ${r1(kit.postStock)} m`} />
    <Row k={`Corner screws - ${kit.fixPerCourse}/course, both sides`} v={`${kit.cornerScrews} (${kit.cornerScrewBoxes} box${plural(kit.cornerScrewBoxes)})`} hl />
    <Row k="Corner sealant" v={`${kit.cornerSealantBoxes} box${plural(kit.cornerSealantBoxes)} (${kit.cornerSausages} sausages)`} hl />
    <LMLineItem
      label="Corner protection strip"
      pieces={kit.stripPieces} lm={kit.stripLM}
      stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);

/** Shaft wall's own vertical track / floors / slab-pass card (see estimate_shaft_wall.md). */
const ShaftVerticalCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Vertical track" icon={<Frame size={14} />}>
    {out.vertTrackSection ? (
      <>
        <div className={`mb-3 ${cx.infoBox}`}>
          <div className={cx.infoBoxHd}>Selected vertical track section</div>
          <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.vertTrackSection}</div>
          <div className={cx.infoBoxSub}>{out.vertTrackFixPerCourse} fixing{(out.vertTrackFixPerCourse || 1) > 1 ? "s" : ""} each side, per course{out.floors ? ` - ${out.floors} floor${plural(out.floors)}` : ""}</div>
        </div>
        <LMLineItem
          label={`Both vertical edges - +100mm overlap per floor`}
          pieces={out.vertTrackPieces || 0} lm={out.vertTrackLM || 0}
          stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
        {out.vertTrackOutsideTable && (
          <p className={`mt-2 ${cx.infoNote}`}>
            <span className="mt-0.5 shrink-0">i</span>
            Floor height exceeds the standard vertical track table -- confirmed conservatively. Contact Speedpanel.
          </p>
        )}
      </>
    ) : (
      <Row k="Vertical track" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall's slab-related quantities: informational anchor count, slab-pass sealant, protection strip. */
const ShaftSlabCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Slab passes" icon={<Layers size={14} />}>
    {out.floors ? (
      <>
        <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${out.slabAnchors || 0}`} dim />
        <Row k="Slab-pass sealant" v={`${out.slabPassSealantBoxes || 0} box${plural(out.slabPassSealantBoxes || 0)} (${out.slabPassSausages || 0} sausages)`} hl />
        <LMLineItem
          label="Protection strip - one length per slab pass + junction"
          pieces={out.stripPieces || 0} lm={out.stripLM || 0}
          stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
      </>
    ) : (
      <Row k="Slab passes" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall back-to-back junction kit, shared between a linked primary + secondary split wall. */
const ShaftJunctionCard = ({ kit, partnerName }: { kit: ShaftPairResult; partnerName: string }) => (
  <Card title="Back-to-back junction" icon={<Frame size={14} />}>
    <p className="mb-2 text-xs leading-relaxed text-slate-400">Shared with {partnerName} -- calculated once per split.</p>
    <div className={`mb-3 ${cx.infoBox}`}>
      <div className={cx.infoBoxHd}>Selected junction track section</div>
      <div className={cx.infoBoxVal} style={{ color: NAVY }}>{kit.section}</div>
      <div className={cx.infoBoxSub}>{kit.fixPerCourse} fixing{kit.fixPerCourse > 1 ? "s" : ""} each side, per course - {kit.floors} floor{plural(kit.floors)}</div>
    </div>
    <LMLineItem
      label="Back-to-back C-track - +100mm overlap per floor"
      pieces={kit.junctionPieces} lm={kit.junctionLM}
      stockLabel={`stocked @ ${r1(kit.junctionStock)} m`} bordered={false} />
    <Row k="Junction screws" v={`${kit.junctionScrews} (${kit.junctionScrewBoxes} box${plural(kit.junctionScrewBoxes)})`} hl />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);

const PackNote = ({ type, spare }: { type: number; spare?: number }) => {
  const msg = spare && spare > 3
    ? `${spare} spare panels -- part-pack options may be available. Contact Speedpanel.`
    : `Under a full pack (${PACK[type]}) -- contact Speedpanel for part-pack options.`;
  return (
    <p className={cx.packNote}>
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {msg}
    </p>
  );
};

const StockBadge = ({ status }: { status: ReturnType<typeof stockStatus> }) => {
  if (status.type === "stocked")
    return <span className={`${cx.badge} bg-emerald-50 text-emerald-700`}>Stocked</span>;
  if (status.type === "near-stock")
    return <span className={`${cx.badge} bg-blue-50 text-blue-600`}>^ {r1(status.length)} m</span>;
  return <span className={`${cx.badge} bg-amber-50 text-amber-700`}>Custom</span>;
};

const ScheduleRow = ({ mm, ordered, qty, packs, packSize, stocks, isLast, packNumber }: {
  mm: number; ordered: number; qty: number; packs: number; packSize: number; stocks: number[]; isLast: boolean; packNumber?: number;
}) => {
  const status = stockStatus(mm, stocks);
  return (
    <div className={`py-3.5 ${isLast ? "" : "border-b border-slate-100"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {packNumber != null && (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
              {packs > 1 ? `Pack ${packNumber}-${packNumber + packs - 1}` : `Pack ${packNumber}`}
            </span>
          )}
          <span className="text-base font-bold tracking-tight" style={{ color: NAVY }}>{mm.toLocaleString()} mm</span>
          <StockBadge status={status} />
        </div>
        <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between" style={{fontSize:"14px",color:"#94a3b8"}}>
        <span>{qty} req · {packs} pack{packs !== 1 ? "s" : ""} of {packSize}</span>
        <span>{ordered - qty} spare</span>
      </div>
    </div>
  );
};

// --- SpanTable ----------------------------------------------------------------
const SpanTable = ({ orient, type, wallSystem }: { orient: string; type: number; wallSystem?: WallSystemId }) => {
  const [open, setOpen] = useState(false);
  const TH = "py-2.5 px-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100";
  const TD = "py-2.5 px-3 text-sm text-slate-600 border-b border-slate-100 last:border-0";
  const TDm = "py-2.5 px-3 text-sm font-semibold border-b border-slate-100 last:border-0";
  const label = orient === "vertical" ? `Span table - P${type}` : `C-track span table - P${type}`;

  if (orient === "vertical") {
    const rows = SPAN_TABLE_VERT.filter(r => r.type === `P${type}`);
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100">
              <thead><tr><th className={TH}>Panel</th><th className={TH}>Max W</th><th className={TH}>Max H</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} className="bg-blue-50/60">
                  <td className={TDm} style={{ color: BLUE }}>{r.type}</td>
                  <td className={TD}>{r.maxW}</td>
                  <td className={TD}>{r.maxH}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400">Height limits apply without steel structure.</div>
          </>
        )}
      </div>
    );
  }

  // "Standard wall" and "Corner wall" (see estimate_single_wall.md and
  // estimate_free_corner_wall.md) both use one fixed C-track section for their
  // own run-level track, regardless of width/height -- no span-table lookup
  // (matches computeHorizCtrack). Show that single section here instead of the
  // generic multi-row span table, so the reference info matches what's
  // actually being ordered. (Corner wall's post has its own separate table,
  // shown inline in the corner-kit card once linked, not here.)
  if (wallSystem === "standard" || wallSystem === "corner") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100">
              <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
              <tbody>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{MAX_W_HORIZ} m</td>
                  <td className={TD}>{MAX_H_HORIZ[type]} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{CTRACK_DIM[type]}</td>
                  <td className={TD}>1/face</td>
                </tr>
              </tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400">
              {wallSystem === "standard"
                ? "Standard wall: fixed C-track section, no span-table lookup. All four edges restrained."
                : "Corner wall: fixed C-track section on the supported side. The free-corner post has its own size table -- see the corner kit once linked."}
            </div>
          </>
        )}
      </div>
    );
  }

  // "Shaft wall" (see estimate_shaft_wall.md): vertical track is sized by
  // floor height F alone, not width/height -- an entirely different table
  // shape (SHAFT_TRACK_TABLE) than the generic span table below. Shown here
  // as reference; the actual selection (driven by the wall's own floor
  // height) appears in the Vertical track card once floor height is entered.
  if (wallSystem === "shaft") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>Vertical track table - P78</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100">
              <thead><tr><th className={TH}>Floor height up to</th><th className={TH}>Vertical track</th><th className={TH}>Screws each side</th></tr></thead>
              <tbody>{SHAFT_TRACK_TABLE.map((r, i) => (
                <tr key={i}>
                  <td className={TDm} style={{ color: NAVY }}>{r.maxF} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.section}</td>
                  <td className={TD}>{r.fixPerCourse}/course</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400">Sized by floor height (slab to soffit), not total shaft height. Total height stacks to any height.</div>
          </>
        )}
      </div>
    );
  }

  const rows = SPAN_TABLE_HORIZ[type] || SPAN_TABLE_HORIZ[78];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <table className="w-full border-t border-slate-100">
            <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className={r.note ? "bg-amber-50/60" : ""}>
                <td className={TDm} style={{ color: NAVY }}>{r.maxW}</td>
                <td className={TD}>{r.maxH}</td>
                <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cTrack}</td>
                <td className={TD}>{r.fix}</td>
              </tr>
            ))}</tbody>
          </table>
          {type === 78 && <div className="px-3.5 py-2.5 text-sm text-slate-400">Stacked/shaft condition (W 4.5-5.0 m): height unlimited for material estimating only.</div>}
        </>
      )}
    </div>
  );
};

// --- ProfileSelector ----------------------------------------------------------
const ProfileSelector = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    {([ ["standard","Standard"], ["rake","Raked"], ["gable","Gable"] ] as [ProfileId, string][]).map(([id, lbl]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
          style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
      );
    })}
  </div>
);

// --- WallSystemSelector --------------------------------------------------------
// Horizontal-only wall system variant (Standard / Corner / Shaft), each with its
// own calculation logic: Standard (estimate_single_wall.md -- fixed C-track,
// all edges restrained), Corner (estimate_free_corner_wall.md -- 3-edge runs +
// linked corner post kit), Shaft (estimate_shaft_wall.md -- floor-height-driven
// vertical track + linked back-to-back junction kit). See computeWall's
// normalization block and each system's dedicated step-function branches.
type WallSystemId = "standard" | "corner" | "shaft";
const WALL_SYSTEMS: [WallSystemId, string][] = [
  ["standard", "Standard wall"],
  ["corner",   "Corner wall"],
  ["shaft",    "Shaft wall"],
];

const WallSystemSelector = ({ value, onChange }: { value: WallSystemId; onChange: (id: WallSystemId) => void }) => (
  <div className="border-t border-slate-100 pt-3">
    <div className={cx.cardHd}>Wall system</div>
    <div className="grid grid-cols-3 items-end gap-1.5">
      {WALL_SYSTEMS.map(([id, label]) => {
        const on = value === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            className={"w-full rounded-xl border-2 py-3.5 px-2 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
            style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
            {label.replace(" wall", "")}
          </button>
        );
      })}
    </div>
  </div>
);

// --- CornerLinkSelector ---------------------------------------------------------
// Corner wall (see estimate_free_corner_wall.md): each run is entered as its own
// wall, then linked to its partner run to form a pair sharing one free corner.
// linkable excludes the active wall itself and any wall already linked to a
// third wall (a wall can only be in one pair at a time).
const CornerLinkSelector = ({ active, walls, onLink, onSideChange }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
  onSideChange: (side: "left" | "right") => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id && w.orient === "horizontal" && w.wallSystem === "corner" &&
    (w.cornerPartnerId == null || w.cornerPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.cornerPartnerId);
  return (
    <div className="border-t border-slate-100 pt-3">
      <div className={cx.cardHd}>Corner partner run</div>
      <div className="space-y-1.5">
        <button onClick={() => onLink(null)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (!partner ? "" : "border-slate-200 bg-white")}
          style={!partner ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
          Not linked
        </button>
        {linkable.map(w => {
          const on = partner?.id === w.id;
          return (
            <button key={w.id} onClick={() => onLink(w.id)}
              className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
              style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
              {w.name}
            </button>
          );
        })}
      </div>
      {!partner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Link this run to another Corner wall run to calculate the shared corner post, screws, sealant, and protection strip.
        </p>
      )}
      {partner && (
        <>
          <div className="mt-2.5">
            <div className={cx.cardHd}>Free corner side (this run)</div>
            <div className="grid grid-cols-2 items-end gap-1.5">
              {(["left", "right"] as const).map(side => {
                const on = (active.cornerSide ?? "right") === side;
                return (
                  <button key={side} onClick={() => onSideChange(side)}
                    className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
                    style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
                    {side === "left" ? "Left" : "Right"}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Linked to <span className="font-semibold">{partner.name}</span>. This run's {active.cornerSide === "left" ? "left" : "right"} edge is the free corner -- no track/screws on that side; the corner kit covers it.
          </p>
        </>
      )}
    </div>
  );
};

// --- ShaftLinkSelector -----------------------------------------------------------
// Shaft wall (see estimate_shaft_wall.md): a shaft can have a primary stack
// wall and, optionally, a secondary split wall -- each estimated fully
// independently, but sharing one back-to-back C-track junction where the
// secondary splits off (per user clarification -- not stated explicitly in
// the doc). No side selector needed here (unlike Corner wall): the two stack
// walls don't share an edge orientation, just the one junction component.
const ShaftLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id && w.orient === "horizontal" && w.wallSystem === "shaft" &&
    (w.shaftPartnerId == null || w.shaftPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.shaftPartnerId);
  return (
    <div className="border-t border-slate-100 pt-3">
      <div className={cx.cardHd}>Secondary split wall</div>
      <div className="space-y-1.5">
        <button onClick={() => onLink(null)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (!partner ? "" : "border-slate-200 bg-white")}
          style={!partner ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
          Not linked
        </button>
        {linkable.map(w => {
          const on = partner?.id === w.id;
          return (
            <button key={w.id} onClick={() => onLink(w.id)}
              className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
              style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
              {w.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        {partner
          ? <>Linked to <span className="font-semibold">{partner.name}</span>. Both stack walls are estimated independently, plus a shared back-to-back C-track junction where they split.</>
          : "Link this wall to a secondary split stack wall if the shaft has one, to calculate the shared back-to-back junction track."}
      </p>
    </div>
  );
};

// --- JunctionLinkSelector -----------------------------------------------------
// Generic wall-to-wall adjoining link, available on ANY wall regardless of
// orientation or wallSystem -- unlike Corner/Shaft wall's partner links,
// this isn't tied to a specific wallSystem's own kit. It only produces an
// extra C/J track allowance when the two linked walls have different
// orientations (see src/estimate/calculateConnectionMaterials.ts); linking
// two walls of the same orientation is harmless (no material is added) but
// isn't the intended use, so the note below is explicit about that.
const JunctionLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id &&
    (w.junctionPartnerId == null || w.junctionPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.junctionPartnerId);
  return (
    <div className="border-t border-slate-100 pt-3">
      <div className={cx.cardHd}>Adjoining wall (junction)</div>
      <div className="space-y-1.5">
        <button onClick={() => onLink(null)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (!partner ? "" : "border-slate-200 bg-white")}
          style={!partner ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
          Not linked
        </button>
        {linkable.map(w => {
          const on = partner?.id === w.id;
          return (
            <button key={w.id} onClick={() => onLink(w.id)}
              className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
              style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
              {w.name} <span className="font-normal" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>({w.orient === "vertical" ? "Vert" : "Horiz"})</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        {partner
          ? partner.orient !== active.orient
            ? <>Linked to <span className="font-semibold">{partner.name}</span>. Combined estimate includes an extra C/J track allowance where these two walls meet.</>
            : <>Linked to <span className="font-semibold">{partner.name}</span>. Same orientation -- no extra junction material is added.</>
          : "Mark another wall in this project as physically adjoining this one, so the combined estimate can allow for the extra C/J track needed where a vertical and horizontal wall meet."}
      </p>
    </div>
  );
};

// --- EstimateModeSelector -----------------------------------------------------
const EstimateModeSelector = ({ visible, mode, setMode }: { visible: boolean; mode: string; setMode: (m: string) => void }) => {
  if (!visible) return null;
  return (
    <div className="mt-4 grid grid-cols-2 items-end gap-2">
      {[["single","Selected wall estimate"],["project","Combined wall estimate"]].map(([k, lbl]) => {
        const on = mode === k;
        return (
          <button key={k} onClick={() => setMode(k)}
            className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
            style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
        );
      })}
    </div>
  );
};

// --- WarningsList -------------------------------------------------------------
const WarningsList = ({ warnings }: { warnings?: string[] | null }) => {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-5 space-y-3">
      {warnings.map((w, i) => (
        <div key={i} className={cx.warnbox}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" /><span>{w}</span>
        </div>
      ))}
    </div>
  );
};

// --- EdgeRestraintSelector ----------------------------------------------------
type FinishKey = "headFinish" | "bottomFinish" | "leftFinish" | "rightFinish";
type DimField = "width" | "height" | "leftH" | "rightH" | "eavesH" | "apexH" | "ridgeX" | "floorHeight";
type CornersField = "intCorners" | "extCorners";
type ActiveFinishes = Record<FinishKey, string>;

interface EdgeRestraintProps {
  edges: EdgeState;
  onEdgeToggle: (k: keyof EdgeState) => void;
  options?: { key: string; label: string; sublabel?: string; value: boolean; onToggle: () => void }[];
  orient: string;
  showTrackFinish?: boolean;
  setShowTrackFinish?: (fn: (v: boolean) => boolean) => void;
  activeFinishes?: ActiveFinishes;
  onFinishChange?: (field: FinishKey, val: string) => void;
  corners?: { intCorners: string; extCorners: string; onChange: (field: CornersField, val: string) => void };
  locked?: boolean; // Standard wall: all 4 edges restrained is fixed by the spec, not user-editable
}

const EdgeRestraintSelector = ({
  edges, onEdgeToggle, options = [], orient,
  showTrackFinish, setShowTrackFinish, activeFinishes, onFinishChange,
  corners = { intCorners: "", extCorners: "", onChange: () => {} },
  locked = false,
}: EdgeRestraintProps) => {
  const flashOption = options.find(o => o.key === "headFlash");

  const EdgeBtn = ({ edgeKey, label }: { edgeKey: keyof EdgeState; label: string }) => {
    const on = locked || edges[edgeKey];
    return (
      <button onClick={locked ? undefined : () => onEdgeToggle(edgeKey)} disabled={locked}
        className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center transition-all " + (locked ? "cursor-default" : "active:scale-95") + (on ? "" : " border-slate-200 bg-white")}
        style={on ? { borderColor: BLUE, background: BLUE, color: "#fff", opacity: locked ? 0.85 : 1 } : { color: "#94a3b8" }}>
        {on ? "✓ " : ""}{label}
      </button>
    );
  };

  const TrackSwitch = ({ field, label }: { field: FinishKey; label: string }) => {
    const isJ = activeFinishes ? activeFinishes[field] === "J" : false;
    return (
      <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-slate-500">{isJ ? "J-track" : "C-track"}</span>
          <button onClick={() => onFinishChange && onFinishChange(field, isJ ? "C" : "J")}
            style={{ background: isJ ? BLUE : "#cbd5e1", width: 44, height: 24, borderRadius: 12, position: "relative", border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 2, left: isJ ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block" }} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={cx.section}>
      {/* Restrained edges */}
      <div>
        <div className={cx.cardHd}>Restrained edges</div>
        <div className="grid grid-cols-2 items-end gap-2">
          <EdgeBtn edgeKey="top" label="Head" />
          <EdgeBtn edgeKey="bottom" label="Base" />
          <EdgeBtn edgeKey="left" label="Left" />
          <EdgeBtn edgeKey="right" label="Right" />
        </div>
        {locked && (
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Standard wall assumes all four edges restrained (slab, soffit, and structure both sides).
          </p>
        )}
      </div>

      {/* Advanced track selection */}
      {showTrackFinish !== undefined && setShowTrackFinish && (
        <div>
          <button onClick={() => setShowTrackFinish(v => !v)}
            className={`${cx.accordionInner} active:scale-95`}>
            <span>Advanced track selection</span>
            <ChevronDown size={13} className={`text-slate-400 transition-transform ${showTrackFinish ? "rotate-180" : ""}`} />
          </button>
          {showTrackFinish && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white px-3">
              {(([
                edges.top    ? { field: "headFinish"   as FinishKey, label: "Head" }   : null,
                edges.bottom ? { field: "bottomFinish" as FinishKey, label: "Base" }   : null,
                edges.left   && orient === "vertical" ? { field: "leftFinish"  as FinishKey, label: "Left" }  : null,
                edges.right  && orient === "vertical" ? { field: "rightFinish" as FinishKey, label: "Right" } : null,
              ]).filter((x): x is { field: FinishKey; label: string } => x !== null)).map(({ field, label }) => (
                <TrackSwitch key={label} field={field} label={label} />
              ))}
              {!edges.top && !edges.bottom && !edges.left && !edges.right && (
                <p className="py-3 text-center text-sm text-slate-400">No restrained edges selected</p>
              )}
              <p className="py-2.5 text-sm text-slate-400">J-track available on P78 panels only</p>
            </div>
          )}
        </div>
      )}

      {/* Head track flashing */}
      {flashOption && (
        <div className="flex w-full items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-2">
          <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Head track flashing</span>
          <button onClick={flashOption.onToggle}
            style={{
              background: flashOption.value ? BLUE : "#cbd5e1",
              width: 44, height: 24, borderRadius: 12, position: "relative",
              border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
            }}>
            <span style={{
              position: "absolute", top: 2, left: flashOption.value ? 22 : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block",
            }} />
          </button>
        </div>
      )}

      {/* Other options */}
      {options.filter(o => o.key !== "headFlash").length > 0 && (
        <div className="space-y-2">
          {options.filter(o => o.key !== "headFlash").map(({ key, label, sublabel, value, onToggle }) => (
            <button key={key} onClick={onToggle}
              className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (value ? "" : "border-slate-200 bg-white text-slate-500")}
              style={value ? { borderColor: BLUE, background: BLUE, color: "#fff" } : undefined}>
              {value ? "✓ " : ""}{label}
              {sublabel && <span className={`text-sm font-normal ${value ? "text-white/70" : "text-slate-400"}`}> {sublabel}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Corner angles */}
      <div className="border-t border-slate-100 pt-3">
        <div className={cx.cardHd}>Corner angles</div>
        <div className="grid grid-cols-2 items-end gap-2">
          <div>
            <div>
              <label className={cx.lbl}>Internal</label>
              <input type="number" inputMode="decimal" value={corners.intCorners}
                onChange={e => corners.onChange("intCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
            </div>
          </div>
          <div>
            <div>
              <label className={cx.lbl}>External</label>
              <input type="number" inputMode="decimal" value={corners.extCorners}
                onChange={e => corners.onChange("extCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Shared layout components -------------------------------------------------

/** Decorative "Project quantities" section divider used in both calculators. */
const ProjectSeparator = () => (
  <div className="mt-4 mb-2 flex items-center gap-2">
    <div className="h-px flex-1" style={{ background: "#bfdbfe" }} />
    <span className={cx.pill} style={{ background: BLUE }}>Project quantities</span>
    <div className="h-px flex-1" style={{ background: "#bfdbfe" }} />
  </div>
);

/** Stock-group row used in both project order cards (internal AggPanelEntry / external ExtAggGroup). */
const StockGroupRow = ({ stock, ordered, pieces, packs, packSize, spare, stocks, isLast, typeLabel, packNote }: {
  stock: number; ordered: number; pieces: number; packs: number; packSize: number; spare: number;
  stocks: number[]; isLast: boolean;
  typeLabel?: string; // e.g. "P78" prefix -- omit for external which has no type column
  packNote?: React.ReactNode;
}) => (
  <div className={`py-2 ${!isLast ? "border-b border-slate-100" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold" style={{ color: NAVY }}>
          {typeLabel ? `${typeLabel} - ` : ""}{r1(stock)} m
        </span>
        <StockBadge status={stockStatus(stock * 1000, stocks)} />
      </div>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
    </div>
    <div className={cx.rowSub}>{pieces} req - {packs} pack{packs !== 1 ? "s" : ""} of {packSize} - {spare} spare</div>
    {packNote}
  </div>
);

interface CustomLengthSectionProps {
  dimUnit: string;
  customLengthInput: string;
  customActive: boolean;
  projectLock: boolean;
  projectStock: string;
  wallCount: number;
  commitCustomLength: (raw: string) => void;
  toggleCustom: () => void;
}

/** Custom-length input + toggle, shared between internal and external calculators. */
const CustomLengthSection = ({ dimUnit, customLengthInput, customActive, projectLock, projectStock, wallCount, commitCustomLength, toggleCustom }: CustomLengthSectionProps) => {
  const parsedM = makeToM(dimUnit)(customLengthInput);
  const numM = parseFloat(parsedM);
  const overMax = numM > CUSTOM_MAX_LENGTH + 1e-9;
  return (
    <div className="border-t border-slate-100 pt-3 mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Custom length</label>
        <ToggleSwitch active={customActive} label={customActive ? "Active" : "Off"} onToggle={toggleCustom} />
      </div>
      <input
        type="number" inputMode="decimal"
        placeholder={dimUnit === "mm" ? "e.g. 7200" : "e.g. 7.2"}
        value={customLengthInput}
        onChange={e => commitCustomLength(e.target.value)}
        className={`${cx.input} font-medium`}
        style={{
          color: NAVY,
          borderColor: overMax ? "#f59e0b" : customActive ? BLUE : undefined,
          boxShadow: customActive && !overMax ? `0 0 0 2px ${BLUE}22` : undefined,
          opacity: customActive ? 1 : 0.5,
        }} />
      {overMax && customActive && (
        <p className="mt-1.5 flex gap-1 text-sm leading-relaxed text-amber-700">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Exceeds {CUSTOM_MAX_LENGTH} m maximum -- contact Speedpanel.
        </p>
      )}
      {customActive && numM > 0 && !overMax && projectLock && (
        <ProjectLockNote wallCount={wallCount} stock={projectStock} dimUnit={dimUnit} numM={numM} customActive />
      )}
    </div>
  );
};

// --- PanelScheduleCard --------------------------------------------------------
const PanelScheduleCard = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => (
  <Card title={title} icon={icon}>
    {customSchedule && customSchedule.length > 0 ? (
      <>
        {showCustomNote && (
          <p className={`mb-2 ${cx.footnote}`} style={{paddingTop:0}}>
            {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
          </p>
        )}
        {customSchedule.map((s, i) => (
          <ScheduleRow key={i} mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={packSize} stocks={stocks} isLast={i === customSchedule.length - 1} packNumber={s.packNumber} />
        ))}
        <div className={cx.hr}>
          <Row k="Total required" v={`${customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} />
          <Row k="Total to order" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
          <Row k="Spare" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0) - customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} dim />
        </div>
      </>
    ) : (
      <>
        {(groups || []).map((g, i) => {
          const status = stockStatus(g.stock * 1000, stocks);
          return (
            <div key={i} className={`py-2 ${i < (groups!.length - 1) ? "border-b border-slate-100" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: NAVY }}>{r1(g.stock)} m</span>
                  <StockBadge status={status} />
                </div>
                <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{g.ordered} panels</span>
              </div>
              <div className={cx.rowSub}>
                {g.pieces} req · {g.packs} pack{g.packs !== 1 ? "s" : ""} of {g.ps || packSize} · {g.spare} spare
              </div>
              {(g.underPack || g.spare > 3) && <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />}
            </div>
          );
        })}
        {(!groups || groups.length === 0) && <Row k="No panels yet" v="--" dim />}
        <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim /></div>
      </>
    )}
  </Card>
);

// --- PanelScheduleTable ---------------------------------------------------------
// Web/tablet counterpart to PanelScheduleCard: same props, same underlying
// data (stockStatus/StockBadge/PackNote/typeFromPackSize), just rendered as a
// real <table> (matching SpanTable's TH/TD conventions) instead of stacked rows.
const PanelScheduleTable = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => {
  const TH = "py-2.5 px-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100";
  const TD = "py-2.5 px-2 text-sm text-slate-600 border-b border-slate-100 last:border-0";
  const TDm = "py-2.5 px-2 text-sm font-semibold border-b border-slate-100 last:border-0";
  const hasCustom = customSchedule && customSchedule.length > 0;

  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}>{icon}</span>{title}
      </div>
      {hasCustom && showCustomNote && (
        <p className={`mb-2 ${cx.footnote}`} style={{ paddingTop: 0 }}>
          {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
        </p>
      )}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[400px]">
        <thead>
          <tr>
            <th className={TH}>{hasCustom ? "Length" : "Stock"}</th>
            <th className={TH}>Status</th>
            <th className={TH}>Req.</th>
            <th className={TH}>Packs</th>
            <th className={TH}>Ord.</th>
            <th className={TH}>Spare</th>
          </tr>
        </thead>
        <tbody>
          {hasCustom ? customSchedule!.map((s, i) => {
            const status = stockStatus(s.mm, stocks);
            return (
              <tr key={i}>
                <td className={TDm} style={{ color: NAVY }}>
                  {s.packNumber != null && (
                    <span className="mr-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
                      {s.packs > 1 ? `Pack ${s.packNumber}-${s.packNumber + s.packs - 1}` : `Pack ${s.packNumber}`}
                    </span>
                  )}
                  {s.mm.toLocaleString()} mm
                </td>
                <td className={TD}><StockBadge status={status} /></td>
                <td className={TD}>{s.qty}</td>
                <td className={TD}>{s.packs} of {packSize}</td>
                <td className={TDm} style={{ color: BLUE }}>{s.ordered}</td>
                <td className={TD}>{s.ordered - s.qty}</td>
              </tr>
            );
          }) : (groups || []).map((g, i) => {
            const status = stockStatus(g.stock * 1000, stocks);
            const showNote = g.underPack || g.spare > 3;
            return (
              <Fragment key={i}>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{r1(g.stock)} m</td>
                  <td className={TD}><StockBadge status={status} /></td>
                  <td className={TD}>{g.pieces}</td>
                  <td className={TD}>{g.packs} of {g.ps || packSize}</td>
                  <td className={TDm} style={{ color: BLUE }}>{g.ordered}</td>
                  <td className={showNote ? "py-2.5 px-2 text-sm text-slate-600" : TD}>{g.spare}</td>
                </tr>
                {showNote && (
                  <tr>
                    <td colSpan={6} className="pb-2.5 border-b border-slate-100 last:border-0">
                      <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!hasCustom && (!groups || groups.length === 0) && (
            <tr><td className={TD} colSpan={6}>No panels yet</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div className={cx.hr}>
        {hasCustom ? (
          <>
            <Row k="Total required" v={`${customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} />
            <Row k="Total to order" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
            <Row k="Spare" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0) - customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} dim />
          </>
        ) : (
          <Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim />
        )}
      </div>
    </div>
  );
};

// --- FixingSealantCard --------------------------------------------------------
const FixingSealantCard = ({ title, boxes30, fix30, boxes16, fix16, sealantBoxes, sausages, area, sealantLabel, sealantRate, footnote, p2pNote, p2pEnhanced }: {
  title: string; boxes30: number; fix30: number; boxes16: number; fix16: number;
  sealantBoxes: number; sausages: number; area: number | string;
  sealantLabel: string; sealantRate: number; footnote?: string;
  p2pNote?: string; p2pEnhanced?: boolean;
}) => (
  <Card title={title} icon={<Hammer size={14} />}>
    <Row k="10g 30mm SDS" v={`${boxes30} box${plural(boxes30)}`} hl />
    <Row k="QTY req" v={`${fix30}`} dim />
    <Row k="10g 16mm SDS" v={`${boxes16} box${plural(boxes16)}`} hl />
    <Row k="QTY req" v={`${fix16}`} dim />
    <Row k="Structure fixings (base track)" v="By others / engineer" dim />
    <div className={cx.hr}>
      <Row k={sealantLabel} v={`${sealantBoxes} box${plural(sealantBoxes)} (${sausages} sausages)`} hl />
      <Row k={`area / ${sealantRate} m2/sausage`} v={`${area} m2`} dim />
    </div>
    {p2pEnhanced !== undefined ? (
      <div className="mt-1.5 border-t border-slate-100 pt-1.5 space-y-1">
        {p2pEnhanced ? (
          <>
            <p className="text-sm font-bold" style={{ color: NAVY }}>P78 vertical &gt; 5.0 m -- enhanced panel-to-panel pattern:</p>
            <p className="text-sm leading-relaxed text-slate-500">Joints 1-2 @500mm - 3-4 @750mm - rest @1000mm - one face.</p>
          </>
        ) : (
          <p className={cx.footnote} style={{paddingTop:0}}>Est. fixings -- 1000/box. {p2pNote}</p>
        )}
      </div>
    ) : (
      <p className={cx.footnote}>{footnote || "Est. fixings -- 1000/box."}</p>
    )}
  </Card>
);

// --- TrackFlashingCardInt -----------------------------------------------------
const TrackFlashingCardInt = ({ out, headFlashActive, wall }: { out: ComputeOut; headFlashActive: boolean; wall?: Wall }) => {
  const jEdges: string[] = [];
  if (wall && out.jLM && out.jLM > 0) {
    if (wall.headFinish   === "J" && wall.edges && wall.edges.top)    jEdges.push("head");
    if (wall.bottomFinish === "J" && wall.edges && wall.edges.bottom) jEdges.push("base");
    if (wall.leftFinish   === "J" && wall.edges && wall.edges.left)   jEdges.push("left");
    if (wall.rightFinish  === "J" && wall.edges && wall.edges.right)  jEdges.push("right");
  }
  const jLabel = jEdges.length > 0 ? jEdges.join(" + ") : "selected edges";
  const isShaft = wall?.wallSystem === "shaft";
  return (
    <>
      <Card title={isShaft ? "Top and bottom track" : "Track and flashing"} icon={<Frame size={14} />}>
        {out.horizProfile && (
          <div className={`mb-3 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track section</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
            {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
          </div>
        )}
        {out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label={isShaft ? `Head + base track - ${out.ctrackDim}` : `C-track perimeter - ${out.ctrackDim}`}
            pieces={out.cPieces || 0} lm={out.cLM}
            stockLabel={`stocked @ ${r1(out.cStock || 0)} m`} />
        ) : (
          <Row k="C-track" v="No C-track edges selected" dim />
        )}
        {out.jLM && out.jLM > 0 && (
          <LMLineItem
            label={`J-track - ${jLabel} - ${out.jtrackDim}`}
            pieces={out.jPieces || 0} lm={out.jLM}
            stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
        )}
        {(!out.cLM || out.cLM === 0) && (!out.jLM || out.jLM === 0) && (
          <div className={cx.rowBorder}><Row k="No track yet" v="--" dim /></div>
        )}
        {wall && wall.wallSystem !== "corner" && wall.wallSystem !== "shaft" && (
          <div className="border-t border-slate-100 pt-3">
            <div className={cx.cardHd}>Corner angles</div>
            <Row
              k={`Internal corners${wall.intCorners ? ` x ${wall.intCorners}` : ""}`}
              v={Number(wall.intCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.intCorners) > 0}
              dim={!Number(wall.intCorners)} />
            <Row
              k={`External corners${wall.extCorners ? ` x ${wall.extCorners}` : ""}`}
              v={Number(wall.extCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.extCorners) > 0}
              dim={!Number(wall.extCorners)} />
          </div>
        )}
      </Card>
      {headFlashActive && (
        <HeadFlashingCard dim={out.flashDim || ""} pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={FLASH_STOCK} />
      )}
    </>
  );
};

// --- TrackFlashingCardIntProj -------------------------------------------------
const TrackFlashingCardIntProj = ({ agg, connectionLM = 0, connectionPieces = 0 }: {
  agg: ReturnType<typeof aggregate>; connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg && agg.cTracks.map((c: CTrackAggEntry, i: number) => (
      <div key={i} className={cx.rowBorder}>
        {c.orient === "horizontal" && c.horizProfile && (
          <div className={`mb-1.5 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track - P{c.type}</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{c.horizProfile}</div>
            <div className={cx.infoBoxSub}>{c.horizFix} fixing{c.horizFix > 1 ? "s" : ""} each face - most conservative</div>
          </div>
        )}
        <LMLineItem
          label={c.orient === "horizontal" ? `C-track perimeter - P${c.type}` : `C-track vert P${c.type} - ${CTRACK_DIM[c.type]}`}
          pieces={c.pieces} lm={c.lm} stockLabel={`stocked @ ${r1(c.stock)} m`} bordered={false} />
      </div>
    ))}
    {agg && agg.jLM > 0 && (
      <LMLineItem
        label={`J-track - ${JTRACK_DIM[78]} - 1.15 mm BMT`}
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
    )}
    {agg && agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} />
    )}
    {agg && agg.vertTrackLM > 0 && (
      <LMLineItem
        label="Shaft vertical track (both edges, all shaft walls)"
        pieces={agg.vertTrackPieces} lm={agg.vertTrackLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.cornerPostLM > 0 && (
      <LMLineItem
        label="Corner posts (linked pairs)"
        pieces={agg.cornerPostPieces} lm={agg.cornerPostLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.junctionLM > 0 && (
      <LMLineItem
        label="Back-to-back junctions (linked pairs)"
        pieces={agg.junctionPieces} lm={agg.junctionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.stripLM > 0 && (
      <LMLineItem
        label="Protection strips (corner + shaft)"
        pieces={agg.stripPieces} lm={agg.stripLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    )}
    {connectionPieces > 0 && (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
    )}
    {(!agg || (agg.cTracks.length === 0 && agg.jLM === 0 && agg.flashLM === 0 && agg.vertTrackLM === 0 && agg.cornerPostLM === 0 && agg.junctionLM === 0)) && connectionPieces === 0 && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- TrackFlashingCardExt -----------------------------------------------------
const TrackFlashingCardExt = ({ out, orient, headFlashActive }: { out: ComputeOut; orient: string; headFlashActive: boolean }) => (
  <>
    <Card title="Track and flashing" icon={<Frame size={14} />}>
      {orient === "horizontal" ? (
        <>
          {out.horizProfile && (
            <div className={`mb-2 ${cx.infoBox}`}>
              <div className={cx.infoBoxHd}>Selected C-track section</div>
              <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
              {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
            </div>
          )}
          {out.cLM && out.cLM > 0 ? (
            <LMLineItem
              label={`C-track perimeter - ${out.ctrackDim}`}
              pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`@ ${r1(EXT_CTRACK_STOCK[0])} m`} />
          ) : <Row k="C-track" v="No edges selected" dim />}
        </>
      ) : (
        out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label="C-track - Head + 2 sides"
            pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
        ) : <Row k="C-track" v="No head/side edges selected" dim />
      )}
      {out.jLM && out.jLM > 0 && (
        <LMLineItem
          label="J-track - Base"
          pieces={out.jPieces || 0} lm={out.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
      )}
      {out.zLM && out.zLM > 0 && (
        <LMLineItem
          label="Z-flashing (coloured)"
          pieces={out.zPieces || 0} lm={out.zLM} stockLabel={`${EXT_ZFLASH_DIM} - @ ${r1(EXT_ZFLASH_STOCK)} m`} />
      )}
    </Card>
    {headFlashActive && (
      <HeadFlashingCard
        dim="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={3.0} />
    )}
  </>
);

// --- TrackFlashingCardExtProj -------------------------------------------------
const TrackFlashingCardExtProj = ({ agg, connectionLM = 0, connectionPieces = 0 }: {
  agg: ReturnType<typeof buildExtProjAgg>; connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg.cLM > 0 && (
      <LMLineItem
        label="C-track - Head + 2 sides"
        pieces={agg.cPieces} lm={agg.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
    )}
    {agg.jLM > 0 && (
      <LMLineItem
        label="J-track - Base"
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
    )}
    {agg.zLM > 0 && (
      <LMLineItem
        label="Z-flashing (coloured)"
        pieces={agg.zPieces} lm={agg.zLM} stockLabel={`@ ${r1(EXT_ZFLASH_STOCK)} m`} />
    )}
    {agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`@ ${r1(FLASH_STOCK)} m`} />
    )}
    {connectionPieces > 0 && (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg.cLM === 0 && agg.jLM === 0 && agg.zLM === 0 && connectionPieces === 0 && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- ProfileSection -------------------------------------------------------------
// Profile selector (Standard/Raked/Gable) plus its contextual info note.
// Renders without its own card wrapper -- callers nest this inside the same
// cx.section card as the Dimensions block that follows it. Only the change
// callback differs between the internal and external calculator call sites.
type ProfileId = "standard" | "rake" | "gable";
const ProfileSection = ({ profile, onChange }: { profile: ProfileId; onChange: (id: ProfileId) => void }) => (
  <>
    <div className={cx.cardHd}>Profile</div>
    <ProfileSelector value={profile} onChange={onChange} />
    {profile === "rake" && (
      <p className={cx.infoNote}>
        <span className="mt-0.5 shrink-0">i</span>
        {RAKE_NOTE}
      </p>
    )}
  </>
);

// --- DimensionInputs ----------------------------------------------------------
interface DimensionInputsProps {
  active: Wall; toDisp: (m: string) => string; toM: (d: string) => string;
  updDim: (field: DimField, d: string) => void;
  /** Single callback for non-dimension patch updates. */
  onUpdate: (patch: Partial<Wall>) => void;
  out: ComputeOut; orient: string;
}
const DimensionInputs = ({ active, toDisp, toM, updDim, onUpdate, out, orient }: DimensionInputsProps) => {
  const isShaft = orient === "horizontal" && active.wallSystem === "shaft";
  return (
    <>
      <div className="grid grid-cols-2 items-end gap-2">
        <Num label="Width"  value={toDisp(active.width)}  onChange={v => updDim("width", v)} />
        {active.profile === "standard" && !isShaft && <Num label="Height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />}
        {active.profile === "standard" && isShaft && (
          <>
            <Num label="Total shaft height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />
            <Num label="Floor height (slab to soffit)" value={toDisp(active.floorHeight || "")} onChange={v => updDim("floorHeight", v)} />
          </>
        )}
        {active.profile === "rake" && (
          <>
            <Num label="Left height"  value={toDisp(active.leftH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right height" value={toDisp(active.rightH)} onChange={v => updDim("rightH", v)} />
          </>
        )}
        {active.profile === "gable" && (
          <>
            <Num label="Left eaves height"  value={toDisp(active.leftH || active.eavesH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right eaves height" value={toDisp(active.rightH || active.eavesH)} onChange={v => updDim("rightH", v)} />
            <Num label="Ridge / apex height" value={toDisp(active.apexH)} onChange={v => updDim("apexH", v)} />
            <Num label="Ridge from left -- blank = centred" value={toDisp(active.ridgeX)} onChange={v => updDim("ridgeX", v)} />
          </>
        )}
      </div>
      {isShaft && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
          Shaft wall stacks continuously -- total height drives panel/screw counts; floor height sizes the vertical track (see estimate_shaft_wall.md).
        </p>
      )}
      {!out.empty && (out.maxH || 0) > 6.1 && orient === "vertical" && (
        <p className={cx.infoNote}>
          <span className="mt-0.5 shrink-0">i</span>
          Panels greater than 6.0 m are heavier and harder to handle on site. Speak to Speedpanel about installing a nib.
        </p>
      )}
    </>
  );
};

// --- WallsCard ----------------------------------------------------------------
interface WallsCardProps {
  walls: Wall[]; results: WallResult[];
  activeId: number; setActiveId: (id: number) => void;
  active: Wall; update: (patch: Partial<Wall>) => void;
  addBlankWall: () => void; duplicateWall: () => void; deleteWall: () => void;
  warnById: Record<number, boolean>; showTypes?: boolean;
  systemSelector?: React.ReactNode; // optional system buttons rendered at the top
  orient?: "vertical" | "horizontal"; // gates the horizontal-only wall system dropdown
  onCornerLink?: (targetId: number | null) => void; // Corner wall run linking (internal only)
  onShaftLink?: (targetId: number | null) => void; // Shaft wall primary/secondary linking (internal only)
  onJunctionLink?: (targetId: number | null) => void; // Generic adjoining-wall linking -- any orient/wallSystem, Internal or External
}
const WallsCard = ({ walls, results, activeId, setActiveId, active, update, addBlankWall, duplicateWall, deleteWall, warnById, showTypes = true, systemSelector, orient, onCornerLink, onShaftLink, onJunctionLink }: WallsCardProps) => (
  <div className={cx.section}>
    {/* 1 -- System selector */}
    {systemSelector && (
      <div>
        {systemSelector}
      </div>
    )}
    {/* 1b -- Horizontal-only wall system dropdown (Standard / Corner / Shaft). Internal
        only -- Standard/Corner/Shaft wall calculation logic doesn't apply to External. */}
    {showTypes && orient === "horizontal" && (
      <>
        <WallSystemSelector
          value={active.wallSystem}
          onChange={id => update(id === "shaft" ? { wallSystem: id, type: 78 } : { wallSystem: id })}
        />
        {active.wallSystem === "corner" && onCornerLink && (
          <CornerLinkSelector
            active={active} walls={walls}
            onLink={onCornerLink}
            onSideChange={side => update({ cornerSide: side })}
          />
        )}
        {active.wallSystem === "shaft" && onShaftLink && (
          <ShaftLinkSelector active={active} walls={walls} onLink={onShaftLink} />
        )}
      </>
    )}
    {/* 1c -- Generic adjoining-wall junction link. Not gated by showTypes/
        orient/wallSystem -- available on every wall in either calculator
        (Internal or External), since a junction can occur between any two
        walls in the project (see JunctionLinkSelector). */}
    {onJunctionLink && walls.length > 1 && (
      <JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} />
    )}
    {/* 2 -- Panel configuration (internal only). Shaft wall is always 78 mm --
        hidden rather than shown-but-disabled, since it's not a user choice. */}
    {showTypes && active.wallSystem !== "shaft" && (
      <div className={systemSelector ? "border-t border-slate-100 pt-3" : ""}>
        <div className={cx.cardHd}>Panel configuration</div>
        <div className="grid grid-cols-3 items-end gap-1.5">
          {TYPES.map(t => {
            const on = active.type === t.id;
            return (
              <button key={t.id} onClick={() => update({ type: t.id })}
                className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
                style={on ? { borderColor: BLUE, background: BLUE } : undefined}>
                <div className="text-base font-black leading-none tracking-tight" style={{ color: on ? "#fff" : BLUE }}>{t.label}</div>
                <div className="mt-1 text-xs font-semibold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{t.depth}</div>
                <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>FRL {t.frl}</div>
              </button>
            );
          })}
        </div>
      </div>
    )}
    {showTypes && active.wallSystem === "shaft" && (
      <div className={systemSelector ? "border-t border-slate-100 pt-3" : ""}>
        <div className={cx.cardHd}>Panel configuration</div>
        <div className="rounded-xl border-2 py-3 px-4 text-center" style={{ borderColor: BLUE, background: BLUE }}>
          <div className="text-base font-black leading-none tracking-tight text-white">78 mm</div>
          <div className="mt-1 text-xs font-semibold tracking-wide text-white/70">Shaft wall is always 78 mm - 120 min FRL</div>
        </div>
      </div>
    )}
    {/* 3 -- Wall tabs + name + actions */}
    <div className={showTypes || systemSelector ? "border-t border-slate-100 pt-3" : ""}>
      <div className={cx.cardHd}>Walls ({walls.length})</div>
      <div className="flex flex-wrap gap-2 pb-1">
        {results.map(({ wall: w, out: r }) => {
          const on = w.id === activeId;
          return (
            <button key={w.id} onClick={() => setActiveId(w.id)}
              className={"relative rounded-xl border-2 px-3.5 py-3 text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 bg-white")}
              style={on ? { borderColor: BLUE, background: BLUE } : undefined}>
              {warnById[w.id] && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />}
              <div className="max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold" style={{ color: on ? "#fff" : NAVY }}>{w.name}</div>
              <div className="mt-1 text-xs font-medium" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>
                {w.orient === "vertical" ? "Vert" : "Horiz"} · P{w.type}{r.empty ? "" : ` · ${r.area} m2`}
              </div>
            </button>
          );
        })}
        <button onClick={addBlankWall}
          className="shrink-0 rounded-xl border-2 border-dashed px-3.5 py-3 text-left active:scale-95 transition-all bg-white"
          style={{ borderColor: BLUE }}>
          <div className="flex items-center gap-1">
            <Plus size={14} style={{ color: BLUE }} />
            <span className="text-sm font-bold" style={{ color: BLUE }}>Add</span>
          </div>
          <div className="mt-1 text-xs font-medium text-transparent">-</div>
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input value={active.name} onChange={e => update({ name: e.target.value })} maxLength={32} className={cx.wallName} style={{ color: NAVY }} />
        <button onClick={duplicateWall} title="Duplicate" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm active:scale-95"><Copy size={15} /></button>
        <button onClick={deleteWall} disabled={walls.length === 1} title="Delete"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-sm active:scale-95 ${walls.length === 1 ? "border-slate-100 text-slate-300" : "border-slate-200 bg-white text-red-400"}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  </div>
);

// --- WallsSummaryTable ----------------------------------------------------------
// Web/tablet-only "all walls at a glance" table. No new state -- driven entirely
// by data already computed by the wall store / useWallResults (results/activeId/warnById);
// clicking a row calls the same setActiveId used by WallsCard's tab strip.
const WallsSummaryTable = ({ results, activeId, setActiveId, warnById, toDisp, dimUnit }: {
  results: WallResult[]; activeId: number; setActiveId: (id: number) => void;
  warnById: Record<number, boolean>; toDisp: (m: string) => string; dimUnit: string;
}) => {
  const TH = "py-2.5 px-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100";
  const TD = "py-2.5 px-3 text-sm text-slate-600 border-b border-slate-100 last:border-0";
  const TDm = "py-2.5 px-3 text-sm font-semibold border-b border-slate-100 last:border-0";
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}><Frame size={14} /></span>Walls ({results.length})
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <th className={TH}>Wall</th>
            <th className={TH}>Orientation</th>
            <th className={TH}>Type</th>
            <th className={TH}>Width</th>
            <th className={TH}>Height</th>
            <th className={TH}>Area</th>
            <th className={TH}>Panels</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ wall, out }) => {
            const on = wall.id === activeId;
            return (
              <tr key={wall.id} onClick={() => setActiveId(wall.id)}
                className={`cursor-pointer transition-colors ${on ? "bg-blue-50/60" : "hover:bg-slate-50"}`}>
                <td className={TDm} style={{ color: NAVY }}>
                  {warnById[wall.id] && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: GOLD }} />}
                  {wall.name}
                </td>
                <td className={TD}>{wall.orient === "vertical" ? "Vertical" : "Horizontal"}</td>
                <td className={TD}>P{wall.type}</td>
                <td className={TD}>{dim(wall.width)}</td>
                <td className={TD}>{dim(wall.height)}</td>
                <td className={TD}>{out.empty ? "--" : `${out.area} m2`}</td>
                <td className={TD}>{out.empty ? "--" : (out.chosen?.panels ?? out.result?.panels ?? "--")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

// --- useWallStore -------------------------------------------------------------
// Owns the single, SHARED wall/project state used by BOTH the Internal
// (SpeedpanelEstimator) and External (ExternalCalculator) calculators. One list
// survives every orientation/wall-type switch (the raw Wall shape is identical
// across modes -- orientation is not stored on a wall, and External compute
// ignores the Internal-only fields), and is persisted to the device so the
// project restores on reopen. Compute-agnostic: per-mode results are derived
// separately via useWallResults.
const PROJECT_KEY = "speedpanel:project";

interface PersistedProject {
  v: number;
  walls: Wall[];
  activeId: number;
  nextId: number;
  projectStock: string;
  projectLock: boolean;
  customLengthInput: string;
  customActive: boolean;
}

function loadProject(): PersistedProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.walls) || p.walls.length === 0) return null;
    // Backfill orient for projects saved before orientation became per-wall.
    p.walls = p.walls.map((w: Wall) => ({ ...w, orient: w.orient ?? "vertical" }));
    return p as PersistedProject;
  } catch {
    return null;
  }
}

function useWallStore({ dimUnit, onWallAdded }: { dimUnit: string; onWallAdded?: () => void }) {
  const saved = loadProject();
  const [walls, setWalls]               = useState<Wall[]>(() => saved ? saved.walls : [defaultWall(1)]);
  const [activeId, setActiveId]         = useState(() => saved ? saved.activeId : 1);
  const [nextId, setNextId]             = useState(() => saved ? saved.nextId : 2);
  const [projectStock, setProjectStock] = useState(() => saved ? saved.projectStock : "");
  const [projectLock, setProjectLock]   = useState(() => saved ? saved.projectLock : false);
  const [customLengthInput, setCustomLengthInput] = useState(() => saved ? saved.customLengthInput : "");
  const [customActive, setCustomActive] = useState(() => saved ? saved.customActive : false);

  // Persist the whole project to the device on any change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PersistedProject = {
      v: 1, walls, activeId, nextId, projectStock, projectLock, customLengthInput, customActive,
    };
    try { window.localStorage.setItem(PROJECT_KEY, JSON.stringify(payload)); } catch { /* ignore quota/serialization errors */ }
  }, [walls, activeId, nextId, projectStock, projectLock, customLengthInput, customActive]);

  const active = walls.find(w => w.id === activeId) || walls[0];
  const update = (patch: Partial<Wall>) =>
    setWalls(ws => ws.map(w => w.id === activeId ? { ...w, ...patch } : w));
  const toDisp = makeToDisp(dimUnit);
  const toM    = makeToM(dimUnit);
  const updDim = (field: DimField, d: string) =>
    update({ [field]: toM(d) } as Pick<Wall, DimField>);

  // Apply or clear the project-wide stocked length across all walls.
  const setProjectLength = (stock: string, locked: boolean) => {
    setProjectStock(stock);
    setProjectLock(locked);
    setWalls(ws => ws.map(w => ({ ...w, forcedStock: locked ? stock : "" })));
  };

  // Resolve the forced stock value to inherit when adding/duplicating a wall.
  // When projectLock is on and customActive is on, the typed metres value is used
  // (rounded to 3dp) so the new wall immediately inherits the custom length.
  const projectForcedStock = (): string => {
    if (!projectLock) return "";
    if (customActive) {
      const val = parseFloat(makeToM(dimUnit)(customLengthInput));
      return val > 0 ? String(Math.round(val * 1000) / 1000) : projectStock;
    }
    return projectStock;
  };

  const addBlankWall = () => {
    const id = nextId;
    setWalls(ws => [...ws, { ...defaultWall(id, active.orient), forcedStock: projectForcedStock() }]);
    setNextId(id + 1);
    setActiveId(id);
    onWallAdded?.();
  };

  const duplicateWall = () => {
    const id = nextId;
    setWalls(ws => [...ws, {
      ...active, id,
      name: `${active.name} copy`,
      forcedStock: projectLock ? projectForcedStock() : active.forcedStock,
    }]);
    setNextId(id + 1);
    setActiveId(id);
    onWallAdded?.();
  };

  const deleteWall = () => {
    if (walls.length === 1) return;
    const rest = walls
      .filter(w => w.id !== activeId)
      // If the deleted wall was linked to another (Corner or Shaft wall
      // pairing), clear the surviving wall's side of the link too -- a
      // dangling cornerPartnerId/shaftPartnerId would point at a wall that no
      // longer exists.
      .map(w => w.cornerPartnerId === activeId ? { ...w, cornerPartnerId: null } : w)
      .map(w => w.shaftPartnerId === activeId ? { ...w, shaftPartnerId: null } : w)
      .map(w => w.junctionPartnerId === activeId ? { ...w, junctionPartnerId: null } : w);
    setWalls(rest);
    setActiveId(rest[0].id);
  };

  // Commit the typed custom length to forcedStock on the active wall (or all
  // walls if locked). If raw is empty or invalid, clears forcedStock so the
  // stock-length dropdown drives it again.
  const commitCustomLength = (raw: string, isActive: boolean = customActive) => {
    setCustomLengthInput(raw);
    if (!isActive) return;
    const val = parseFloat(makeToM(dimUnit)(raw));
    const stock = val > 0 ? String(Math.round(val * 1000) / 1000) : "";
    if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: stock }))); }
    else { update({ forcedStock: stock }); }
  };

  // Toggle custom length mode on/off.
  const toggleCustom = () => {
    const next = !customActive;
    setCustomActive(next);
    if (next) {
      // Activating: apply any already-typed value immediately.
      const val = parseFloat(makeToM(dimUnit)(customLengthInput));
      if (val > 0) {
        const stock = String(Math.round(val * 1000) / 1000);
        if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: stock }))); }
        else { update({ forcedStock: stock }); }
      }
    } else {
      // Deactivating: restore dropdown-driven value.
      if (projectLock) { setWalls(ws => ws.map(w => ({ ...w, forcedStock: projectStock }))); }
      else { update({ forcedStock: "" }); }
    }
  };

  // Reset all wall state back to a single blank wall. Used by resetAll (the
  // header reset button) -- NOT by switchSystem anymore, which now preserves walls.
  const resetWalls = () => {
    setWalls([defaultWall(1)]);
    setActiveId(1);
    setNextId(2);
    setProjectStock("");
    setProjectLock(false);
    setCustomLengthInput("");
    setCustomActive(false);
  };

  // Clear custom length state -- called when the dim unit switches so a stale
  // typed value (e.g. "7200" entered in mm mode) doesn't linger in m mode.
  const clearCustomLength = () => { setCustomLengthInput(""); setCustomActive(false); };

  // Symmetric junction linking (see Wall.junctionPartnerId): marks two walls as
  // physically adjoining for the combined estimate's connection/junction
  // material calculation (src/estimate/calculateConnectionMaterials.ts). Lives
  // here (rather than per-calculator) since it's generic -- available on any
  // wall regardless of orientation/wallSystem, and needed by both the Internal
  // and External calculators, which share this one store.
  const linkJunctionPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.junctionPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, junctionPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, junctionPartnerId: activeId };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, junctionPartnerId: null };
        if (targetId !== null && w.junctionPartnerId === targetId && w.id !== activeId) return { ...w, junctionPartnerId: null };
        return w;
      });
    });
  };

  return {
    walls, setWalls, activeId, setActiveId, nextId, setNextId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, projectForcedStock,
    addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, resetWalls, clearCustomLength,
    linkJunctionPartner,
  };
}

// Shared store type, threaded from SpeedpanelEstimator down into ExternalCalculator
// so both calculators read/write the same wall list.
type WallStore = ReturnType<typeof useWallStore>;

// --- useWallResults -----------------------------------------------------------
// Derives the per-mode compute results from the shared wall list. Called once
// per active calculator with that mode's compute function (compute vs
// computeExternal), so the same walls produce Internal or External estimates
// without touching the stored data. Each wall carries its own `orient`, so a
// combined/project estimate can freely mix vertical and horizontal walls --
// this must NOT be overridden with a single shared orientation here.
function useWallResults(
  walls: Wall[], activeId: number,
  computeFn: (inp: WallInput) => ComputeOut,
) {
  // PERF NOTE: walls array reference changes on every keystroke (setWalls creates
  // a new array), so this memo re-runs all wall computations on each input event.
  // For typical project sizes (<=20 walls) this is fast enough. If wall counts
  // grow, consider a per-wall memo keyed by wall id + a shallow hash of inputs.
  const results = useMemo<WallResult[]>(
    () => walls.map(w => ({ wall: w, out: computeFn(w) })),
    [walls]
  );
  const out = useMemo(
    () => (results.find(r => r.wall.id === activeId) || { out: { empty: true, warnings: [], notes: [] } }).out
       || { empty: true, warnings: [], notes: [] },
    [results, activeId]
  );
  const warnById = Object.fromEntries(
    results.map(r => [r.wall.id, !!(r.out.warnings && r.out.warnings.length > 0)])
  );
  return { results, out, warnById };
}

// --- LayoutModeToggle -----------------------------------------------------------
// Icon button showing whichever layout is currently in effect; click forces
// the other one. Placed in the header next to the reset button.
const LayoutModeToggle = ({ effective, onToggle }: { effective: EffectiveLayout; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "phone" ? "Layout: Phone (click for Web)" : "Layout: Web (click for Phone)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm active:scale-95 transition-all"
  >
    {effective === "phone" ? <Smartphone size={16} /> : <Monitor size={16} />}
  </button>
);

// --- CalculatorShell --------------------------------------------------------
// Composes the same sidebar/main/footer content differently depending on
// layout mode. Phone reproduces today's stacked order exactly (byte-for-byte
// equivalent JSX, just relocated into variables); web arranges it as a sticky
// sidebar + wider main column.
const CalculatorShell = ({ layoutMode, sidebar, main, footer }: {
  layoutMode: EffectiveLayout; sidebar: React.ReactNode; main: React.ReactNode; footer: React.ReactNode;
}) => (
  // No space-y-* here: every child component already carries its own correct
  // top margin (mt-3/mt-5/etc., matching phone layout exactly). space-y-*'s
  // generated selector (> :not([hidden]) ~ :not([hidden])) has HIGHER CSS
  // specificity than a plain utility class like mt-5, so it was silently
  // overriding every child's real margin down to a flat 4px -- the actual
  // cause of web layout's spacing looking compressed/inconsistent vs phone.
  <div className="grid grid-cols-[360px_1fr] items-start gap-6">
    <aside className="sticky top-5">{sidebar}</aside>
    <div className="min-w-0">{main}{footer}</div>
  </div>
);

// --- ExternalCalculator -------------------------------------------------------
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by SpeedpanelEstimator) so it
// survives switching in/out of External mode. orient stays in useWallResults'
// dependency array to prevent stale compute if this component is kept mounted
// across orientation switches.
function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode }: { store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string; setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout }) {
  const [extMode, setExtMode] = useState("project");
  const [showTakeoff, setShowTakeoff] = useState(true);
  const [showLocked, setShowLocked] = useState(false);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, computeExternal);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const project  = extMode === "project";
  const projAgg  = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);

  const edgeOptions = [
    { key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) },
  ];

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  const sidebarNode = (
    <>
      <WallsCard
        walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
        active={active} update={update} addBlankWall={addBlankWall}
        duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById} showTypes={false}
        systemSelector={systemSelector} orient={orient}
        onJunctionLink={linkJunctionPartner}
      />

      <SectionLabel icon={<Box size={13} />}>Panel configuration</SectionLabel>
      <div className={cx.section}>
        {/* P78 badge -- styled to match internal panel type buttons */}
        <div className={cx.cardHd}>Panel type</div>
        {(() => {
          const isCustom = active.colourType === "special";
          const stockedHex = !isCustom && active.colour ? COLOUR_HEX[active.colour] : null;
          const isLight = active.colour === "OW";
          const colourName = !isCustom && active.colour
            ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? ""
            : "";
          const badgeBg = isCustom ? GOLD : stockedHex ?? BLUE;
          const textColour = isCustom ? NAVY : isLight ? NAVY : "#fff";

          return (
            <div className="w-full rounded-xl border-2 py-3.5 px-3 transition-all" style={{ borderColor: badgeBg, background: badgeBg, transition: "background 0.3s, border-color 0.3s" }}>
              <div className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: textColour }}>
                {isCustom ? "P78 - Custom" : `P78${colourName ? ` - ${colourName}` : ""}`}
              </div>
            </div>
          );
        })()}
        {/* Colour selection */}
        <div className="border-t border-slate-100 pt-3">
          <div className={cx.cardHd}>Colour selection</div>
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {[...EXT_STOCKED_COLOURS.map(c => {
              const hex = COLOUR_HEX[c.code];
              const selected = active.colour === c.code && active.colourType === "stocked";
              const isLight = c.code === "OW";
              const textColour = isLight ? NAVY : "#fff";
              return (
                <button key={c.code} onClick={() => update({ colour: c.code, colourType: "stocked" })}
                  className="w-full rounded-xl border-2 py-3 px-1.5 text-center transition-all active:scale-95"
                  style={{
                    background: hex,
                    borderColor: selected ? BLUE : "rgba(0,0,0,0.08)",
                    boxShadow: selected ? `0 0 0 2px ${BLUE}` : undefined,
                  }}>
                  <div className="text-[10px] font-bold uppercase leading-tight truncate"
                    style={{ color: textColour }}>{c.label}</div>
                </button>
              );
            }), (() => {
              const selected = active.colourType === "special";
              return (
                <button key="special" onClick={() => update({ colourType: "special", colour: "" })}
                  className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (selected ? "" : "border-slate-200 bg-white")}
                  style={selected ? { borderColor: BLUE, background: BLUE } : undefined}>
                  <div className="text-[10px] font-bold uppercase leading-tight"
                    style={{ color: selected ? "#fff" : BLUE }}>Custom</div>
                </button>
              );
            })()]}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
            <ToggleSwitch
              active={projectLock}
              label={projectLock ? "Project locked" : "Lock to project"}
              onToggle={() => {
                const currentStock = projectLock ? projectStock : (active.forcedStock || "");
                setProjectLength(customActive ? "" : currentStock, !projectLock);
                if (projectLock) { clearCustomLength(); }
              }}
            />
          </div>
          <LengthExplorer
            pieces={"pieces" in out && out.pieces ? out.pieces : []}
            stocks={EXT_STOCK}
            packType={78}
            currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
            onSelect={val => {
              clearCustomLength();
              if (projectLock) { setProjectLength(val, true); }
              else { update({ forcedStock: val }); }
            }}
            isExt
          />

          {/* Custom length -- always visible below the dropdown */}
          <CustomLengthSection
            dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
            projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
            commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
          />

          {/* Project lock confirmation for stocked lengths */}
          {projectLock && !customActive && projectStock && (
            <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
          )}
        </div>
      </div>

      <SectionLabel icon={<Frame size={13} />}>Wall geometry</SectionLabel>
      <div className={cx.section}>
        <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
            <div className="flex items-center gap-2">
              <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
            </div>
          </div>
          <DimensionInputs active={active} toDisp={toDisp} toM={toM} updDim={updDim} onUpdate={update} out={out} orient={orient} />
          <SpanTable orient={orient} type={78} />
        </div>
      </div>

      <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
      <EdgeRestraintSelector
        edges={active.edges}
        onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
        options={edgeOptions}
        orient={orient}
        corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
      />

      <WarningsList warnings={!out.empty ? out.warnings : null} />
      <EstimateModeSelector visible={!out.empty} mode={extMode} setMode={setExtMode} />
    </>
  );

  const mainNode = (
    <>
      {!out.empty && !project && out.result && (
        <>
          <button onClick={() => setShowTakeoff(!showTakeoff)} className={cx.accordion}>
            <span>Material quantities</span>
            <ChevronDown size={15} className={`transition-transform ${showTakeoff ? "rotate-180" : ""}`} />
          </button>
          {showTakeoff && (() => {
            const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
            const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
            return (
            <div className="mt-3">
              <StatsRow area={`${out.area} m2`} panels={out.result!.panels} panelType="P78" />
              {active.colour && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: GOLD, background: "#fffbeb" }}>
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Colour</span>
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                    {active.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600">Special order</span>}
                  </div>
              )}
              <CardGrid layoutMode={layoutMode} minWidth={380}>
                <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                  packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={orient} />
                <TrackFlashingCardExt out={out} orient={orient} headFlashActive={active.headFlash} />
                <FixingSealantCard title="Fixing and sealant quantities"
                  boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                  boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                  sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                  sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              </CardGrid>
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </div>
            );
          })()}
        </>
      )}

      {project && (
        <>
          <ProjectSeparator />

          {layoutMode === "web" && (
            <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
          )}

          {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
          <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
          <CardGrid layoutMode={layoutMode} minWidth={420}>
            {results.map(({ wall: w, out: o }) => (
              <SystemBreakdownWallCardExt key={w.id} wall={w} out={o} ScheduleComp={ScheduleComp} />
            ))}
          </CardGrid>

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
          <ConnectionBreakdownCard connections={combinedEstimate.connections} />

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
          <StatsRow area={`${projAgg.totalArea} m2`} panels={projAgg.panels} panelType="P78" />
          <CardGrid layoutMode={layoutMode} minWidth={300}>
            <Card title="Project order estimate" icon={<Box size={14} />}>
              {projAgg.groups.map((g: ExtAggGroup, i: number) => (
                <StockGroupRow key={i}
                  stock={g.stock} ordered={g.ordered} pieces={g.pieces}
                  packs={g.packs} packSize={EXT_PACK} spare={g.spare}
                  stocks={EXT_STOCK} isLast={i === projAgg.groups.length - 1}
                />
              ))}
              {projAgg.groups.length === 0 && <Row k="No panels yet" v="--" dim />}
            </Card>
            <TrackFlashingCardExtProj agg={projAgg}
              connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
            <FixingSealantCard title="Fixing and sealant -- whole project"
              boxes30={projAgg.boxes30} fix30={projAgg.fix30}
              boxes16={projAgg.boxes16} fix16={projAgg.fix16}
              sealantBoxes={projAgg.sealantBoxes} sausages={projAgg.sausages} area={projAgg.totalArea}
              sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
          </CardGrid>
        </>
      )}
    </>
  );

  const footerNode = (
    <>
      <button onClick={() => setShowLocked(!showLocked)} className={cx.accordion}>
        <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400" /> Locked external system data</span>
        <ChevronDown size={16} className={`text-blue-300 transition-transform ${showLocked ? "rotate-180" : ""}`} />
      </button>
      {showLocked && <LockedDataExt />}
      <button className={cx.exportBtn} style={{ background: NAVY }}>Export PDF</button>
    </>
  );

  if (layoutMode === "phone") {
    return <div>{sidebarNode}{mainNode}{footerNode}</div>;
  }
  return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}

// --- SystemBreakdownWallCard ---------------------------------------------------
// One wall's own section of the combined estimate's "System Breakdown" --
// shows HOW that wall's estimate was built (name, orientation, dimensions,
// selected system, materials, C/J allowances, flashing, fixings,
// assumptions/warnings), reusing the exact same single-wall display
// components the "Selected wall estimate" view uses. Collapsible so a large
// project doesn't force scrolling past every wall to reach the Easy to Order
// summary; each wall keeps its own open/closed state.
const SystemBreakdownWallCard = ({ wall, out, walls, ScheduleComp }: {
  wall: Wall; out: ComputeOut; walls: Wall[];
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const cornerPartner = wall.wallSystem === "corner" && wall.cornerPartnerId != null
    ? walls.find(w => w.id === wall.cornerPartnerId) : undefined;
  const cornerKit = cornerPartner ? computeCornerPair(wall, cornerPartner, INT_CONFIG) : null;
  const shaftPartner = wall.wallSystem === "shaft" && wall.shaftPartnerId != null
    ? walls.find(w => w.id === wall.shaftPartnerId) : undefined;
  const shaftKit = shaftPartner ? computeShaftPair(wall, shaftPartner, INT_CONFIG) : null;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, Internal, P{wall.type}
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.chosen?.panels ?? out.result?.panels ?? "--"} panelType={`P${wall.type}`} />
              {out.chosen && !out.chosen.invalid && (
                <ScheduleComp title={`Panel schedule -- P${wall.type}`} icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.chosen.groups}
                  packSize={PACK[wall.type]} stocks={STOCK_LENGTHS}
                  wastePct={out.chosen.wastePct} orient={wall.orient} />
              )}
              <TrackFlashingCardInt out={out} headFlashActive={wall.headFlash} wall={wall} />
              {wall.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
              {cornerKit && <CornerKitCard kit={cornerKit} partnerName={cornerPartner?.name ?? "linked run"} />}
              {shaftKit && <ShaftJunctionCard kit={shaftKit} partnerName={shaftPartner?.name ?? "linked wall"} />}
              {wall.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Hilti CP606 sealant" sealantRate={4}
                p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- ConnectionBreakdownCard ---------------------------------------------------
// Shows WHY each junction material was added -- the source walls, the length/
// quantity, and the reason -- separate from the System Breakdown (which shows
// each wall's OWN materials) so the connection logic stays visible and easy
// to audit independently, per the combined-estimate flow.
const ConnectionBreakdownCard = ({ connections }: { connections: ConnectionMaterial[] }) => (
  <Card title="Connection breakdown" icon={<Frame size={14} />}>
    {connections.length === 0 && (
      <Row k="No adjoining walls linked yet" v="--" dim />
    )}
    {connections.map(c => (
      <div key={c.id} className={cx.rowBorder}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: NAVY }}>Extra C/J track</span>
          <span className={cx.rowVal} style={{ color: BLUE }}>{c.pieces} length{plural(c.pieces)}</span>
        </div>
        <div className="mt-1.5 text-sm text-slate-500">
          Between <span className="font-semibold">{c.wallAName}</span> ({c.wallAOrient}) and{" "}
          <span className="font-semibold">{c.wallBName}</span> ({c.wallBOrient})
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Length {r1(c.lengthM)} lm - qty {c.quantity} - stocked @ {r1(c.stock)} m - {c.reason}
        </div>
        {c.warnings.map((w, i) => (
          <div key={i} className="mt-1.5 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{w}</span>
          </div>
        ))}
      </div>
    ))}
  </Card>
);

// --- SystemBreakdownWallCardExt -------------------------------------------------
// External-system counterpart to SystemBreakdownWallCard: one wall's own
// section of the combined estimate's System Breakdown, reusing the same
// single-wall display components the External "Selected wall estimate" view
// uses (colour badge, TrackFlashingCardExt, External fixing/sealant rates).
const SystemBreakdownWallCardExt = ({ wall, out, ScheduleComp }: {
  wall: Wall; out: ComputeOut; ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const colourEntry = wall.colour ? EXT_STOCKED_COLOURS.find(c => c.code === wall.colour) : null;
  const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : wall.colour;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, External, P78
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty || !out.result ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.result.panels} panelType="P78" />
              {wall.colour && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: GOLD, background: "#fffbeb" }}>
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Colour</span>
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                  {wall.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600">Special order</span>}
                </div>
              )}
              <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                customSchedule={out.customSchedule}
                groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={wall.orient} />
              <TrackFlashingCardExt out={out} orient={wall.orient} headFlashActive={wall.headFlash} />
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- Session persistence ------------------------------------------------------
// The current view (which system/orientation, project-vs-single mode, and unit)
// is saved alongside the wall project so reopening the app restores the exact
// screen. Kept separate from the wall data (PROJECT_KEY) since it's parent-level.
const SESSION_KEY = "speedpanel:session";
interface PersistedSession { v: number; system: string; mode: string; dimUnit: string; }
function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !SYSTEMS.some(sys => sys.id === s.system)) return null;
    return s as PersistedSession;
  } catch {
    return null;
  }
}

// --- Main app -----------------------------------------------------------------
export default function SpeedpanelEstimator() {
  const savedSession = loadSession();
  const [system, setSystem] = useState(() => savedSession ? savedSession.system : "int-vert");
  const [mode, setMode]     = useState(() => savedSession ? savedSession.mode : "project");
  const [showData, setShowData]               = useState(false);
  const [showWall, setShowWall]               = useState(true);
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  const [dimUnit, setDimUnit] = useState(() => savedSession ? savedSession.dimUnit : "m");
  const { effective: layoutMode, toggleLayout } = useLayoutMode();

  // Persist the current view on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, system, mode, dimUnit })); } catch { /* ignore */ }
  }, [system, mode, dimUnit]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;
  const project = mode === "project";

  // Single SHARED wall store (persisted); the External calculator receives the
  // same `store` so walls survive switching in/out of External mode.
  const store = useWallStore({ dimUnit, onWallAdded: () => setShowWall(true) });
  const {
    walls, setWalls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, resetWalls, clearCustomLength,
    linkJunctionPartner,
  } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;
  const { results, out, warnById } = useWallResults(walls, activeId, compute);

  const projChosenAgg = useMemo(() => aggregate(results), [results]);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view. The persistence
  // effects immediately re-save the clean default, so a later reload stays clear.
  const resetAll     = () => { resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };

  // Symmetric corner-wall linking: setting the active wall's partner to
  // targetId also points targetId back at the active wall, and un-links
  // whichever previous partners either wall had (a wall can only be linked to
  // one other wall at a time -- see estimate_free_corner_wall.md, "always 1
  // corner"). Passing targetId === null unlinks the active wall only.
  // cornerSide defaults are set to opposite sides on link so the pair starts
  // as a sensible right-angle corner rather than both runs claiming the same side.
  const linkCornerPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.cornerPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, cornerPartnerId: targetId, cornerSide: "right" as const };
        if (targetId !== null && w.id === targetId) return { ...w, cornerPartnerId: activeId, cornerSide: "left" as const };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, cornerPartnerId: null };
        // If the newly-chosen partner was itself linked to a third wall, break that old link too.
        if (targetId !== null && w.cornerPartnerId === targetId && w.id !== activeId) return { ...w, cornerPartnerId: null };
        return w;
      });
    });
  };

  const cornerPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "corner" || !active.cornerPartnerId) return null;
    const partner = walls.find(w => w.id === active.cornerPartnerId);
    if (!partner) return null;
    return computeCornerPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  // Symmetric shaft-wall linking (primary <-> secondary split), same pattern
  // as linkCornerPartner -- no side field to default here since Shaft wall
  // doesn't have a "which side" concept, just the shared junction.
  const linkShaftPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.shaftPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, shaftPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, shaftPartnerId: activeId };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, shaftPartnerId: null };
        if (targetId !== null && w.shaftPartnerId === targetId && w.id !== activeId) return { ...w, shaftPartnerId: null };
        return w;
      });
    });
  };

  const shaftPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "shaft" || !active.shaftPartnerId) return null;
    const partner = walls.find(w => w.id === active.shaftPartnerId);
    if (!partner) return null;
    return computeShaftPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  const combinedEstimate = useCombinedEstimateCalc(walls);

  // Switches the ACTIVE wall's own orientation (per-wall now -- see Wall.orient),
  // not a global setting, so other walls in a combined project are unaffected.
  // Corner/Shaft wall systems only make sense for horizontal walls, so switching
  // to vertical resets wallSystem back to "standard" and unlinks any partner
  // (mirroring deleteWall's dangling-partner cleanup) to avoid stale state.
  const switchOrient = (o: "vertical" | "horizontal") => {
    if (o === active.orient) return;
    if (o === "vertical") {
      if (active.wallSystem === "corner" && active.cornerPartnerId != null) linkCornerPartner(null);
      if (active.wallSystem === "shaft" && active.shaftPartnerId != null) linkShaftPartner(null);
      update({ orient: o, wallSystem: "standard" });
    } else {
      update({ orient: o });
    }
    setShowWall(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans" style={{ color: NAVY }}>
      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1400px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <img
              src="data:image/webp;base64,UklGRrQFAABXRUJQVlA4TKcFAAAvj8ETEMdAkG1Tifsnt7jfIQSWyej/k4Mg26ZYI77UZQwEQNGUWsJ0nnggC2T08OPg718UBr0GEIGEYEu23bCRpEeBoiiKFLrd7vZg/0sVAYJKK+ezIvo/AfLH/3/8///v3/Z/OrzG8TJ0HnmNMcY1lzZUa60l55z3Ws+xVp1b76zeplprLflaa53Raq1HvtbanLhaeaxV/bRx7TflrN49rup5r7/ML7kywTHbuBDMIR3aRhgNcT9tEc6xl+GtRMJwiLk5lIjhmJvDAes+FqEvtop+VDK8exVq/jEvuTIBIdpp5AgYz0qEazq/BpyXzCMZrrEOJRPNwP5gL7kyAaGJvdo4wfOYg1C+GxDyHYBtJJhwzgj8WC+5MgGhyYwIV54ElC8HULsDkq3Cvs/A9lQvuTIBocmMDa5RpuH4dgjHHZBN28A6BeczveTKBIQmMyp89xsE/nbAcQc0yzIAnrI+0kuuTEBoMmW1xJxzjsuljS251npkMmD/KmHLueacFltoDvmotebVshoaRssU1Ad6yZUJCE2mMPR4Sv/clyBjUfpH0JYh8TVk8dWiqC1ZQA7Sb6Th1HYlKWkO3aCK6096yZUJwJpzzuxXNRLzOUGahvMriTQyoLgJL1rRqEeHEuagPM1LrkzQid2yttusDpK040sJk2Hxk6JtCqOfWMExJ/CzvOTKBCvx9zi0/K2Eg4bDj7WoFKUIKZsT9ZAf5SVXrkYmgHgW3ad+PzkMyU/GVuWUTVmcioLzQV5yZYIxMQHEPkXDyr8HWbRwI/QXkUNB86lBSQ/SZYI5MQHELqcBofA9snZ8sV3D6XZoW+9Qkohom1NWUJ+FCQhZDUBiAog9hAxA2M4b8KK1kWpvY6naeVYzVLdV23tJKSKyKuTEQYmT9mr/eUxAaKK2ACQmgNijmgBQmZagBhkZjGOjdZYYsleB3npBYRHZFZw+khUcc0Z/HBMQmhhbABITQNxLFkkDQMhTzhV6+mo0iTP0RboNfRIRObXdiYOyPAcTEJqYWwASE0B8SQAOjWkEWKrHkms9coS1fbXolo9a8xpgLL1N2S5CSnSSrKA8BRMQmgy2ACQmoIpIAlDEyGkIyA6OSR5pfJE+KbWzKWAnDsryFASEJsMtAFvuJABF7HsYwjaP+FcQWu9EP0i3asVJsoLyEEBo4tgCYicBKDLKOYzgmEVNvlu4SajS35W1J0FZvTgoi7SHyOIaewlAEUfel4HAc1YWh2jfxpZob9Og1ynURI1KzP1FgZdkBVX8KNq/GQEo4txSsGCfsRxiNYivIYuvWzW0CUsWneF/ePGixAlVXL8SgCL+nC3RjbYm9u+0GcRrSYdYy4TkJUVB+w0Uub7/dRFpQcMI7TnnXKuMf6dFW4dKzjkflWVwnRDchJREz1fk+v54SXWL4v6VCvR9SJzDBDS3quD5ilzfHz8JvwBeDHyPAzM3N4mK+lxFru/PjOUXsEJPco80ZfE7fwGEmItc3x8T88CJx+MVxvMmiybGpqG5SXq8BETpvj+2PWzNwqTFp6oLjJvco0FdLRK03Y/DwyUApfP+DKwAlu1ol3NfoO/3y6N1JObB4tR2gpX4JlnbTUkjP8mTUh4sI0scLD8gAShyfX9GApwD3284jwzHEcQrBkOTm5DWTIeG04+XOcNxZDjfLwEocn1/Rhq8szyMZ2hykxPqImY2FD8pD5YAFLm+P0O7V5THoyZ32bVkk1VbJwg9VgJQ5Pr+jK1OkR9vY7nNqh0DuwaeUJ/Ds8j1/XEIPpsYHyqdMjiFofPAaSgTJD5Xkev741FXh3TKs9F+yvCUopGMkpZmtIeIjkWu//vP/u6JcElkCOt+in2L/c1vi96lU6L31lvjYotrPlg8S1Q99qiWoT2qa2eL/WaTHNVNKdF767ToXSb9zLN2WR661VpP+eP/P3kGAA=="
              alt="Speedpanel"
              className="h-10 w-auto object-contain"
            />
            <p className={cx.lbl} style={{marginTop:"6px", paddingLeft:0}}>Wall Systems Estimator</p>
          </div>
          <div className="flex items-center gap-2">
            <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
            <button onClick={resetAll} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
        <div className="mt-4 h-[2px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />

        {/* System configuration + calculator body */}
        {(() => {
          const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
            SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;

          // Two full-weight rows, each with its own small label, so Orientation and
          // Wall type read as two distinct, equally important decisions -- not one
          // primary control with a smaller secondary one attached to it.
          const SystemRows = () => {
            const isHoriz = orient === "horizontal";
            return (
              <div className="space-y-3">
                <div>
                  <div className={cx.cardHd}>Orientation</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => switchOrient("vertical")}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (!isHoriz ? "" : "border-slate-200 bg-white")}
                      style={!isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M3 1.5v10M6.5 1.5v10M10 1.5v10" stroke={!isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isHoriz ? WHITE : BLUE }}>Vertical</span>
                    </button>
                    <button onClick={() => switchOrient("horizontal")}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (isHoriz ? "" : "border-slate-200 bg-white")}
                      style={isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M1.5 3h10M1.5 6.5h10M1.5 10h10" stroke={isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isHoriz ? WHITE : BLUE }}>Horizontal</span>
                    </button>
                  </div>
                </div>
                <div>
                  <div className={cx.cardHd}>Wall type</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => switchSystem(findSys(orient, false).id)}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (!isExt ? "" : "border-slate-200 bg-white")}
                      style={!isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isExt ? WHITE : BLUE }}>Internal</span>
                    </button>
                    <button onClick={() => switchSystem(findSys(orient, true).id)}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (isExt ? "" : "border-slate-200 bg-white")}
                      style={isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isExt ? WHITE : BLUE }}>External</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          };

          const systemButtons = <SystemRows />;

          if (isExt) return (
            <>
              <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
              <div className="mt-1">
                <ExternalCalculator store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit} systemSelector={systemButtons} layoutMode={layoutMode} />
              </div>
            </>
          );

          const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

          const sidebarNode = (
            <>
              <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
              <WallsCard
                walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
                active={active} update={update} addBlankWall={addBlankWall}
                duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById}
                showTypes={true} systemSelector={systemButtons} orient={orient}
                onCornerLink={linkCornerPartner}
                onShaftLink={linkShaftPartner}
                onJunctionLink={linkJunctionPartner}
              />

              {/* Profile and dimensions */}
              <SectionLabel icon={<Frame size={13} />}>Wall geometry</SectionLabel>
              <div className={cx.section}>
                <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
                    <div className="flex items-center gap-2">
                      <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
                    </div>
                  </div>
                  <DimensionInputs active={active} toDisp={toDisp} toM={toM} updDim={updDim} onUpdate={update} out={out} orient={orient} />
                  <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
                    <ToggleSwitch
                      active={projectLock}
                      label={projectLock ? "Project locked" : "Lock to project"}
                      onToggle={() => {
                        const currentStock = projectLock ? projectStock : (active.forcedStock || "");
                        setProjectLength(customActive ? "" : currentStock, !projectLock);
                        if (projectLock) { clearCustomLength(); }
                      }}
                    />
                  </div>
                  <LengthExplorer
                    pieces={"pieces" in out && out.pieces ? out.pieces : []}
                    stocks={STOCK_LENGTHS}
                    packType={active.type}
                    currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
                    onSelect={val => {
                      clearCustomLength();
                      if (projectLock) { setProjectLength(val, true); }
                      else { update({ forcedStock: val }); }
                    }}
                  />

                  {/* Custom length -- same visual treatment as the panel length selector above */}
                  <CustomLengthSection
                    dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
                    projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
                    commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
                  />

                  {/* Project lock confirmation for stocked lengths */}
                  {projectLock && !customActive && projectStock && (
                    <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
                  )}
                </div>
              </div>

              {/* Tracks and flashing */}
              <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
              <EdgeRestraintSelector
                edges={active.edges}
                onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
                options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
                orient={orient}
                locked={orient === "horizontal" && active.wallSystem === "standard"}
                showTrackFinish={showTrackFinish}
                setShowTrackFinish={setShowTrackFinish}
                activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
                onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
                corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
              />

              <WarningsList warnings={!out.empty ? out.warnings : null} />
              <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />
            </>
          );

          const mainNode = (
            <>
              {/* Single wall estimate */}
              {!out.empty && !project && out.chosen && !out.chosen.invalid && (
                <>
                  <button onClick={() => setShowWall(!showWall)} className={cx.accordion}>
                    <span>Wall estimate -- {active.name}</span>
                    <ChevronDown size={15} className={`transition-transform ${showWall ? "rotate-180" : ""}`} />
                  </button>
                  {showWall && (
                    <div className="mt-3">
                      <StatsRow area={`${out.area} m2`} panels={out.chosen.panels} panelType={`P${active.type}`} />
                      <CardGrid layoutMode={layoutMode} minWidth={420}>
                        <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
                          customSchedule={out.customSchedule}
                          groups={out.chosen.groups}
                          packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
                          wastePct={out.chosen.wastePct} orient={orient} />
                        <TrackFlashingCardInt out={out} headFlashActive={active.headFlash} wall={active} />
                        {active.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
                        {cornerPair && (() => {
                          const partner = walls.find(w => w.id === active.cornerPartnerId);
                          return <CornerKitCard kit={cornerPair} partnerName={partner ? partner.name : "linked run"} />;
                        })()}
                        {shaftPair && (() => {
                          const partner = walls.find(w => w.id === active.shaftPartnerId);
                          return <ShaftJunctionCard kit={shaftPair} partnerName={partner ? partner.name : "linked wall"} />;
                        })()}
                        {active.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
                        <FixingSealantCard title="Fixing and sealant quantities"
                          boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                          boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                          sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                          sealantLabel="Hilti CP606 sealant" sealantRate={4}
                          p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
                      </CardGrid>
                      {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
                    </div>
                  )}
                </>
              )}

              {/* Combined estimate: System Breakdown -> Connection Breakdown -> Easy to Order */}
              {project && (
                <>
                  <ProjectSeparator />

                  {layoutMode === "web" && (
                    <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
                  )}

                  {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
                  <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
                  <CardGrid layoutMode={layoutMode} minWidth={420}>
                    {results.map(({ wall: w, out: o }) => (
                      <SystemBreakdownWallCard key={w.id} wall={w} out={o} walls={walls} ScheduleComp={ScheduleComp} />
                    ))}
                  </CardGrid>

                  {/* Connection Breakdown: shows WHY extra materials were added */}
                  <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
                  <ConnectionBreakdownCard connections={combinedEstimate.connections} />

                  {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
                  <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
                  <StatsRow
                    area={projChosenAgg ? `${projChosenAgg.totalArea} m2` : "--"}
                    panels={projChosenAgg ? projChosenAgg.totalPanels : "--"}
                    panelType={`P${active.type}`}
                  />
                  <CardGrid layoutMode={layoutMode} minWidth={300}>
                    <Card title="Project order estimate" icon={<Box size={14} />}>
                      {projChosenAgg && (
                        <>
                          {projChosenAgg.panels.map((p: AggPanelEntry, i: number) => (
                            <StockGroupRow key={i}
                              stock={p.stock} ordered={p.ordered} pieces={p.pieces}
                              packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
                              stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.panels.length - 1 && projChosenAgg.customPanels.length === 0}
                              typeLabel={`P${p.type}`}
                              packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
                            />
                          ))}
                          {projChosenAgg.customPanels.length > 0 && (
                            <>
                              {projChosenAgg.panels.length > 0 && <p className={cx.cardHd + " pt-2 pb-1"}>Custom lengths</p>}
                              {projChosenAgg.customPanels.map((s: AggCustomEntry, i: number) => (
                                <div key={i}>
                                  <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.customPanels.length - 1} />
                                  {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
                                </div>
                              ))}
                            </>
                          )}
                          {projChosenAgg.panels.length === 0 && projChosenAgg.customPanels.length === 0 && <Row k="No panels yet" v="--" dim />}
                          <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(projChosenAgg.wastePct)}%`} dim /></div>
                        </>
                      )}
                      {!projChosenAgg && <Row k="No panels yet" v="--" dim />}
                    </Card>
                    <TrackFlashingCardIntProj agg={projChosenAgg}
                      connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
                    <Card title="Fixing and sealant -- whole project" icon={<Hammer size={14} />}>
                      {projChosenAgg && (
                        <>
                          <Row k="10g 30mm SDS" v={`${projChosenAgg.boxes30} box${plural(projChosenAgg.boxes30)}`} hl />
                          <Row k="QTY req" v={`${projChosenAgg.fix30}`} dim />
                          <Row k="10g 16mm SDS" v={`${projChosenAgg.boxes16} box${plural(projChosenAgg.boxes16)}`} hl />
                          <Row k="QTY req" v={`${projChosenAgg.fix16}`} dim />
                          <Row k="Structure fixings (base track)" v="By others / engineer" dim />
                          <div className={cx.hr}>
                            <Row k="Hilti CP606 sealant" v={`${projChosenAgg.sealantBoxes} box${plural(projChosenAgg.sealantBoxes)} (${projChosenAgg.sausages} sausages)`} hl />
                            <Row k="total area / 4 m2/sausage" v={`${projChosenAgg.totalArea} m2`} dim />
                          </div>
                          {projChosenAgg.slabPassSausages > 0 && (
                            <div className={cx.hr}>
                              <Row k="Slab-pass sealant" v={`${projChosenAgg.slabPassSealantBoxes} box${plural(projChosenAgg.slabPassSealantBoxes)} (${projChosenAgg.slabPassSausages} sausages)`} hl />
                            </div>
                          )}
                          {projChosenAgg.slabAnchors > 0 && (
                            <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${projChosenAgg.slabAnchors}`} dim />
                          )}
                          <p className={cx.footnote}>Est. fixings pooled - 1000/box.</p>
                          {results.some(r => r.out.p2pEnhanced) && (
                            <p className="pt-1 text-sm leading-relaxed text-amber-700">One or more P78 vertical walls &gt; 5.0 m: enhanced panel-to-panel pattern applied.</p>
                          )}
                        </>
                      )}
                    </Card>
                  </CardGrid>
                </>
              )}
            </>
          );

          const footerNode = (
            <>
              <button onClick={() => setShowData(!showData)} className={cx.accordion}>
                <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400" /> Locked system data</span>
                <ChevronDown size={16} className={`text-blue-300 transition-transform ${showData ? "rotate-180" : ""}`} />
              </button>
              {showData && <LockedDataInt />}
              <button className={cx.exportBtn} style={{ background: NAVY }}>Export PDF</button>
            </>
          );

          if (layoutMode === "phone") return <>{sidebarNode}{mainNode}{footerNode}</>;
          return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
        })()}

        {/* Disclaimer */}
        <div className="mt-8 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-sm leading-relaxed text-amber-800">
            By using this calculator you acknowledge quantities are estimates only and you will not hold Speedpanel liable for over- or under-ordering. Does not confirm compliance, FRL, engineering, restraint, certification or approval.
          </p>
        </div>
      </div>
    </div>
  );
}
