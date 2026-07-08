// =============================================================================
// buildExternalReportData
// =============================================================================
// Adapter: maps ExternalCalculator's already-computed state (results, project
// aggregate, combined estimate, single-wall out) into the framework-agnostic
// EstimateReportData shape consumed by ./buildWorkbook.ts. Mirrors what's on
// screen -- SystemBreakdownSection's wall list, EasyToOrderSectionExt's
// combined material list (project mode), or SingleWallMaterialsSection's own
// cards (single-wall mode). See ./buildInternalReportData.ts for the Internal
// counterpart -- shares almost no logic beyond a couple of constants, same as
// aggregateExternal.ts vs aggregateInternal.ts.
// =============================================================================
import { r1 } from "../estimate/mathUtils";
import { stockStatus } from "../estimate/computeUtils";
import {
  EXT_STOCK, EXT_PACK, EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM,
  EXT_CTRACK_STOCK, EXT_JTRACK_STOCK, EXT_ZFLASH_STOCK, FLASH_STOCK, HORIZ_CTRACK_STOCK,
  EXT_STOCKED_COLOURS,
} from "../data";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";
import type { buildExtProjAgg, ExtAggGroup } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { EstimateReportData, WallSummaryRow, PanelGroupRow, TrackLineRow } from "./reportTypes";

function stockStatusLabel(mm: number, stocks: number[]): PanelGroupRow["status"] {
  const s = stockStatus(mm, stocks);
  return s.type === "stocked" ? "Stocked" : s.type === "near-stock" ? "Near stock" : "Custom";
}

function wallRow(wall: Wall, out: ComputeOut, warn: boolean, dimUnit: string, toDisp: (m: string) => string): WallSummaryRow {
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  return {
    name: wall.name, orientation: wall.orient, panelType: "P78 coloured",
    width: dim(wall.width), height: dim(wall.height),
    area: out.empty ? "--" : `${out.area} m2`,
    panels: out.empty ? "--" : String(out.chosen?.panels ?? out.result?.panels ?? "--"),
    warning: warn,
  };
}

export interface ExternalReportParams {
  extMode: string; orient: "vertical" | "horizontal"; dimUnit: string;
  toDisp: (m: string) => string;
  walls: Wall[]; results: WallResult[]; warnById: Record<number, boolean>;
  active: Wall; out: ComputeOut;
  projAgg: ReturnType<typeof buildExtProjAgg>;
  combinedEstimate: CombinedEstimate;
}

export function buildExternalReportData(p: ExternalReportParams): EstimateReportData {
  const systemLabel = `External calculator - ${p.orient === "vertical" ? "Vertical" : "Horizontal"}`;
  const project = p.extMode === "project";

  if (project) {
    const agg = p.projAgg;
    const walls = p.results.map(({ wall, out }) => wallRow(wall, out, !!p.warnById[wall.id], p.dimUnit, p.toDisp));

    const panelGroups: PanelGroupRow[] = agg.groups.map((g: ExtAggGroup) => ({
      label: `${r1(g.stock)} m`,
      status: stockStatusLabel(g.stock * 1000, EXT_STOCK),
      required: g.pieces, packSize: EXT_PACK, packs: g.packs, ordered: g.ordered, spare: g.spare,
    }));

    const trackLines: TrackLineRow[] = [];
    if (agg.cLM > 0) trackLines.push({ label: "C-track - Head + 2 sides", pieces: agg.cPieces, lengthM: agg.cLM, stockLabel: `${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m` });
    if (agg.jLM > 0) trackLines.push({ label: "J-track - Base", pieces: agg.jPieces, lengthM: agg.jLM, stockLabel: `${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m` });
    if (agg.zLM > 0) trackLines.push({ label: "Z-flashing (coloured)", pieces: agg.zPieces, lengthM: agg.zLM, stockLabel: `@ ${r1(EXT_ZFLASH_STOCK)} m` });
    if (agg.flashLM > 0) trackLines.push({ label: "Head track flashing 0.7 mm BMT x 130 mm GAL", pieces: agg.flashPieces, lengthM: agg.flashLM, stockLabel: `@ ${r1(FLASH_STOCK)} m` });
    if (p.combinedEstimate.connectionPieces > 0) trackLines.push({ label: "Extra C/J track (combined wall junctions)", pieces: p.combinedEstimate.connectionPieces, lengthM: p.combinedEstimate.connectionLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });

    const notes = Array.from(new Set(p.results.flatMap(r => r.out.notes || [])));
    const warnings = Array.from(new Set([...p.results.flatMap(r => r.out.warnings || []), ...p.combinedEstimate.connectionWarnings]));

    return {
      systemLabel, modeLabel: "Project", generatedAt: new Date(),
      totals: { area: agg.totalArea, panels: agg.panels, packs: agg.packs },
      walls, panelGroups, customPanels: [], trackLines,
      fixings: {
        fix30: agg.fix30, boxes30: agg.boxes30, fix16: agg.fix16, boxes16: agg.boxes16,
        sealantLabel: "Sikaflex 400 Fire PU", sealantBoxes: agg.sealantBoxes, sausages: agg.sausages, area: agg.totalArea,
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
  const result = out.result;
  const walls = [wallRow(active, out, !!p.warnById[active.id], p.dimUnit, p.toDisp)];

  const panelGroups: PanelGroupRow[] = (result?.groups || []).map(g => ({
    label: `${r1(g.stock)} m`, status: stockStatusLabel(g.stock * 1000, EXT_STOCK),
    required: g.pieces, packSize: EXT_PACK, packs: g.packs, ordered: g.ordered, spare: g.spare,
  }));
  const customPanels: PanelGroupRow[] = (out.customSchedule || []).map(s => ({
    label: `${s.mm.toLocaleString()} mm`, status: stockStatusLabel(s.mm, EXT_STOCK),
    required: s.qty, packSize: EXT_PACK, packs: s.packs, ordered: s.ordered, spare: s.ordered - s.qty,
  }));

  const trackLines: TrackLineRow[] = [];
  const notes = [...(out.notes || [])];
  if (out.horizProfile) notes.push(`Selected C-track section: ${out.horizProfile}`);
  if (p.orient === "horizontal") {
    if (out.cLM && out.cLM > 0) trackLines.push({ label: `C-track perimeter - ${out.ctrackDim}`, pieces: out.cPieces || 0, lengthM: out.cLM, stockLabel: `@ ${r1(EXT_CTRACK_STOCK[0])} m` });
  } else if (out.cLM && out.cLM > 0) {
    trackLines.push({ label: "C-track - Head + 2 sides", pieces: out.cPieces || 0, lengthM: out.cLM, stockLabel: `${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m` });
  }
  if (out.jLM && out.jLM > 0) trackLines.push({ label: "J-track - Base", pieces: out.jPieces || 0, lengthM: out.jLM, stockLabel: `${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m` });
  if (out.zLM && out.zLM > 0) trackLines.push({ label: "Z-flashing (coloured)", pieces: out.zPieces || 0, lengthM: out.zLM, stockLabel: `${EXT_ZFLASH_DIM} - @ ${r1(EXT_ZFLASH_STOCK)} m` });
  if (active.headFlash && out.flashLM && out.flashLM > 0) trackLines.push({ label: "Head track flashing 0.7 mm BMT x 130 mm GAL", pieces: out.flashPieces || 0, lengthM: out.flashLM, stockLabel: "@ 3.0 m" });

  const extraLines: { label: string; value: string }[] = [];
  if (active.colour) {
    const colourEntry = EXT_STOCKED_COLOURS.find(c => c.code === active.colour);
    const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
    extraLines.push({ label: "Colour", value: active.colourType === "special" ? `${colourDisplay} - special order` : colourDisplay });
  }

  return {
    systemLabel, modeLabel: "Single wall", generatedAt: new Date(),
    totals: { area: out.area ?? 0, panels: result?.panels ?? 0, wastePct: result?.wastePct },
    walls, panelGroups, customPanels, trackLines,
    fixings: {
      fix30: out.fix30 ?? 0, boxes30: out.boxes30 ?? 0, fix16: out.fix16 ?? 0, boxes16: out.boxes16 ?? 0,
      sealantLabel: "Sikaflex 400 Fire PU", sealantBoxes: out.sealantBoxes ?? 0, sausages: out.sausages ?? 0,
      area: out.area ?? 0, extraLines,
    },
    connections: [],
    notes, warnings: out.warnings || [],
  };
}
