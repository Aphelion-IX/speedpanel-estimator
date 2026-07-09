// =============================================================================
// buildInternalReportData
// =============================================================================
// Adapter: maps InternalCalculator's already-computed state (results,
// project aggregate, combined estimate, single-wall out/corner/shaft kits)
// into the framework-agnostic EstimateReportData shape consumed by
// ./buildWorkbook.ts. Mirrors exactly what's on screen -- SystemBreakdownSection's
// wall list, EasyToOrderSection's combined material list (project mode), or
// SingleWallEstimateSection's own cards (single-wall mode).
// =============================================================================
import { r1 } from "../estimate/mathUtils";
import { stockStatus } from "../estimate/computeUtils";
import {
  PACK, STOCK_LENGTHS, JTRACK_STOCK, JTRACK_DIM, FLASH_STOCK, HORIZ_CTRACK_STOCK, CTRACK_DIM,
} from "../data";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";
import type { aggregate, AggPanelEntry, AggCustomEntry, CTrackAggEntry } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import { WALL_SYSTEMS } from "../ui/wallsCard";
import type { EstimateReportData, WallSummaryRow, PanelGroupRow, TrackLineRow } from "./reportTypes";

const wallSystemLabel = (id: Wall["wallSystem"]) => WALL_SYSTEMS.find(([wid]) => wid === id)?.[1];

function stockStatusLabel(mm: number, stocks: number[]): PanelGroupRow["status"] {
  const s = stockStatus(mm, stocks);
  return s.type === "stocked" ? "Stocked" : s.type === "near-stock" ? "Near stock" : "Custom";
}

function wallRow(wall: Wall, out: ComputeOut, warn: boolean, dimUnit: string, toDisp: (m: string) => string): WallSummaryRow {
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  return {
    name: wall.name,
    orientation: wall.orient,
    system: wall.orient === "horizontal" ? wallSystemLabel(wall.wallSystem) : undefined,
    panelType: `P${wall.type}`,
    width: dim(wall.width), height: dim(wall.height),
    area: out.empty ? "--" : `${out.area} m2`,
    panels: out.empty ? "--" : String(out.chosen?.panels ?? "--"),
    warning: warn,
  };
}

export interface InternalReportParams {
  mode: string; orient: "vertical" | "horizontal"; dimUnit: string;
  toDisp: (m: string) => string;
  walls: Wall[]; results: WallResult[]; warnById: Record<number, boolean>;
  active: Wall; out: ComputeOut;
  projChosenAgg: ReturnType<typeof aggregate> | null;
  combinedEstimate: CombinedEstimate;
  cornerPair: CornerPairResult | null;
  shaftPair: ShaftPairResult | null;
}

export function buildInternalReportData(p: InternalReportParams): EstimateReportData {
  const systemLabel = `Internal calculator - ${p.orient === "vertical" ? "Vertical" : "Horizontal"}`;
  const project = p.mode === "project";

  if (project) {
    const agg = p.projChosenAgg;
    const walls = p.results.map(({ wall, out }) => wallRow(wall, out, !!p.warnById[wall.id], p.dimUnit, p.toDisp));

    const panelGroups: PanelGroupRow[] = (agg?.panels || []).map((g: AggPanelEntry) => ({
      label: `P${g.type} - ${g.label}`,
      status: stockStatusLabel(g.stock * 1000, STOCK_LENGTHS),
      required: g.pieces, packSize: g.ps ?? PACK[g.type], packs: g.packs, ordered: g.ordered, spare: g.spare,
      panelType: g.type,
    }));
    const customPanels: PanelGroupRow[] = (agg?.customPanels || []).map((s: AggCustomEntry) => ({
      label: `P${s.type} - ${s.mm.toLocaleString()} mm`,
      status: stockStatusLabel(s.mm, STOCK_LENGTHS),
      required: s.qty, packSize: s.packSize, packs: s.packs, ordered: s.ordered, spare: s.spare,
      panelType: s.type,
    }));

    const trackLines: TrackLineRow[] = [];
    for (const c of (agg?.cTracks || []) as CTrackAggEntry[]) {
      trackLines.push({
        label: c.orient === "horizontal" ? `C-track perimeter - P${c.type}` : `C-track vert P${c.type} - ${CTRACK_DIM[c.type]}`,
        pieces: c.pieces, lengthM: c.lm, stockLabel: `stocked @ ${r1(c.stock)} m`,
        kind: "c-track", system: "internal", panelType: c.type,
      });
    }
    if (agg && agg.jLM > 0) trackLines.push({ label: `J-track - ${JTRACK_DIM[78]} - 1.15 mm BMT`, pieces: agg.jPieces, lengthM: agg.jLM, stockLabel: `stocked @ ${r1(JTRACK_STOCK[0])} m`, kind: "j-track", system: "internal", panelType: 78 });
    if (agg && agg.flashLM > 0) trackLines.push({ label: "Head track flashing 0.7 mm BMT x 130 mm GAL", pieces: agg.flashPieces, lengthM: agg.flashLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m`, kind: "head-flash", system: "internal" });
    // No TrackKind mapping exists in the catalog for these four -- left
    // unmatched/unpriced in v1 (see reportTypes.ts's TrackLineRow comment)
    // rather than guessing which catalog row they should borrow pricing from.
    if (agg && agg.vertTrackLM > 0) trackLines.push({ label: "Shaft vertical track (both edges, all shaft walls)", pieces: agg.vertTrackPieces, lengthM: agg.vertTrackLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
    if (agg && agg.cornerPostLM > 0) trackLines.push({ label: "Corner posts (linked pairs)", pieces: agg.cornerPostPieces, lengthM: agg.cornerPostLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
    if (agg && agg.junctionLM > 0) trackLines.push({ label: "Back-to-back junctions (linked pairs)", pieces: agg.junctionPieces, lengthM: agg.junctionLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
    if (agg && agg.stripLM > 0) trackLines.push({ label: "Protection strips (corner + shaft)", pieces: agg.stripPieces, lengthM: agg.stripLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m` });
    if (p.combinedEstimate.connectionPieces > 0) trackLines.push({ label: "Extra C/J track (combined wall junctions)", pieces: p.combinedEstimate.connectionPieces, lengthM: p.combinedEstimate.connectionLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });

    const extraLines: { label: string; value: string }[] = [];
    if (agg && agg.slabPassSausages > 0) extraLines.push({ label: "Slab-pass sealant", value: `${agg.slabPassSealantBoxes} box(es) (${agg.slabPassSausages} sausages)` });
    if (agg && agg.slabAnchors > 0) extraLines.push({ label: "Slab-edge anchors (by others, not a Speedpanel part)", value: `~${agg.slabAnchors}` });

    const notes = Array.from(new Set(p.results.flatMap(r => r.out.notes || [])));
    if (p.results.some(r => r.out.p2pEnhanced)) notes.push("One or more P78 vertical walls > 5.0 m: enhanced panel-to-panel fixing pattern applied.");
    const warnings = Array.from(new Set([...p.results.flatMap(r => r.out.warnings || []), ...p.combinedEstimate.connectionWarnings]));

    return {
      systemLabel, modeLabel: "Project", generatedAt: new Date(),
      totals: { area: agg?.totalArea ?? 0, panels: agg?.totalPanels ?? 0, packs: agg?.totalPacks, wastePct: agg?.wastePct },
      walls, panelGroups, customPanels, trackLines,
      fixings: {
        fix30: agg?.fix30 ?? 0, boxes30: agg?.boxes30 ?? 0, fix16: agg?.fix16 ?? 0, boxes16: agg?.boxes16 ?? 0,
        sealantLabel: "Hilti CP606 sealant", sealantBoxes: agg?.sealantBoxes ?? 0, sausages: agg?.sausages ?? 0,
        area: agg?.totalArea ?? 0, extraLines,
      },
      connections: p.combinedEstimate.connections.map(c => ({
        wallA: `${c.wallAName} (${c.wallAOrient})`, wallB: `${c.wallBName} (${c.wallBOrient})`,
        lengthM: c.lengthM, quantity: c.quantity, stock: c.stock, pieces: c.pieces, reason: c.reason, warnings: c.warnings,
      })),
      notes, warnings,
    };
  }

  // --- Single-wall mode --------------------------------------------------------
  const { active, out } = p;
  const chosen = out.chosen;
  const walls = [wallRow(active, out, !!p.warnById[active.id], p.dimUnit, p.toDisp)];

  const panelGroups: PanelGroupRow[] = (chosen?.groups || []).map(g => ({
    label: `P${active.type} - ${g.label}`,
    status: stockStatusLabel(g.stock * 1000, STOCK_LENGTHS),
    required: g.pieces, packSize: g.ps ?? PACK[active.type], packs: g.packs, ordered: g.ordered, spare: g.spare,
    panelType: active.type,
  }));
  const customPanels: PanelGroupRow[] = (out.customSchedule || []).map(s => ({
    label: `P${active.type} - ${s.mm.toLocaleString()} mm`,
    status: stockStatusLabel(s.mm, STOCK_LENGTHS),
    required: s.qty, packSize: PACK[active.type], packs: s.packs, ordered: s.ordered, spare: s.ordered - s.qty,
    panelType: active.type,
  }));

  const isShaft = active.wallSystem === "shaft";
  const trackLines: TrackLineRow[] = [];
  if (out.cLM && out.cLM > 0) {
    trackLines.push({
      label: isShaft ? `Head + base track - ${out.ctrackDim}` : `C-track perimeter - ${out.ctrackDim}`,
      pieces: out.cPieces || 0, lengthM: out.cLM, stockLabel: `stocked @ ${r1(out.cStock || 0)} m`,
      kind: "c-track", system: "internal", panelType: active.type,
    });
  }
  if (out.jLM && out.jLM > 0) {
    trackLines.push({ label: `J-track - ${out.jtrackDim}`, pieces: out.jPieces || 0, lengthM: out.jLM, stockLabel: `stocked @ ${r1(JTRACK_STOCK[0])} m`, kind: "j-track", system: "internal", panelType: active.type });
  }
  if (active.headFlash && out.flashLM && out.flashLM > 0) {
    trackLines.push({ label: "Head track flashing", pieces: out.flashPieces || 0, lengthM: out.flashLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m`, kind: "head-flash", system: "internal" });
  }
  // No TrackKind mapping exists in the catalog for these four -- see the
  // project-mode branch above for the same "left unmatched, not guessed" call.
  if (isShaft && out.vertTrackLM && out.vertTrackLM > 0) {
    trackLines.push({ label: "Shaft vertical track (both edges)", pieces: out.vertTrackPieces || 0, lengthM: out.vertTrackLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
  }
  if (isShaft && out.stripLM && out.stripLM > 0) {
    trackLines.push({ label: "Protection strip (slab passes)", pieces: out.stripPieces || 0, lengthM: out.stripLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m` });
  }
  const cp = p.cornerPair, sp = p.shaftPair;
  if (cp) {
    trackLines.push({ label: `Corner post - ${cp.section}`, pieces: cp.postPieces, lengthM: cp.postLM, stockLabel: `stocked @ ${r1(cp.postStock)} m` });
    trackLines.push({ label: "Corner protection strip", pieces: cp.stripPieces, lengthM: cp.stripLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m` });
  }
  if (sp) {
    trackLines.push({ label: `Back-to-back junction - ${sp.section}`, pieces: sp.junctionPieces, lengthM: sp.junctionLM, stockLabel: `stocked @ ${r1(sp.junctionStock)} m` });
  }

  const extraLines: { label: string; value: string }[] = [];
  if (isShaft) {
    extraLines.push({ label: "Slab-edge anchors (by others, not a Speedpanel part)", value: `~${out.slabAnchors || 0}` });
    extraLines.push({ label: "Slab-pass sealant", value: `${out.slabPassSealantBoxes || 0} box(es) (${out.slabPassSausages || 0} sausages)` });
  }
  if (cp) extraLines.push({ label: `Corner screws (${cp.fixPerCourse}/course, both sides)`, value: `${cp.cornerScrews} (${cp.cornerScrewBoxes} box(es))` }, { label: "Corner sealant", value: `${cp.cornerSealantBoxes} box(es) (${cp.cornerSausages} sausages)` });
  if (sp) extraLines.push({ label: "Junction screws", value: `${sp.junctionScrews} (${sp.junctionScrewBoxes} box(es))` });

  const notes = out.notes || [];
  const warnings = [
    ...(out.warnings || []),
    ...(cp?.warnings || []), ...(cp?.notes || []),
    ...(sp?.warnings || []), ...(sp?.notes || []),
  ];

  return {
    systemLabel, modeLabel: "Single wall", generatedAt: new Date(),
    totals: { area: out.area ?? 0, panels: chosen?.panels ?? 0, wastePct: chosen?.wastePct },
    walls, panelGroups, customPanels, trackLines,
    fixings: {
      fix30: out.fix30 ?? 0, boxes30: out.boxes30 ?? 0, fix16: out.fix16 ?? 0, boxes16: out.boxes16 ?? 0,
      sealantLabel: "Hilti CP606 sealant", sealantBoxes: out.sealantBoxes ?? 0, sausages: out.sausages ?? 0,
      area: out.area ?? 0, extraLines,
    },
    connections: [],
    notes, warnings,
  };
}
