// =============================================================================
// buildReportData
// =============================================================================
// Adapter: maps Calculator's already-computed state (results, project
// aggregate, combined estimate) into the framework-agnostic
// EstimateReportData shape consumed by ./buildWorkbook.ts. Concatenates each
// wall's own row (internal + external, in original results order) and each
// side's panel/track lines into the shared flat arrays -- those arrays were
// always just "every line item in the order", so a mixed project's Excel
// export naturally reads as one combined order, not two separate reports.
//
// `fixings` (fix30/fix16/boxes -- the same physical SDS screws regardless of
// application) sums both sides directly. Sealant is genuinely two different
// products (Hilti CP606 for Internal vs Sikaflex 400 for External, see
// aggregateInternal.ts/aggregateExternal.ts) -- for a project with only one
// application, `fixings.sealantLabel`/`sealantBoxes`/`sausages` behave
// exactly as before (single product, single number). For a MIXED project,
// those three fields carry the Internal side (arbitrary but consistent
// "primary" choice) and `fixings.sealantLines` carries a priced-per-system
// breakdown of BOTH sealants -- see priceEstimateReportData.ts, which prices
// from `sealantLines` when present instead of inferring one system from
// `systemLabel` (that inference silently loses External's sealant entirely
// in a mixed project otherwise, since only one sealant can be represented in
// the single sealantLabel/sealantBoxes pair).
//
// Formerly buildInternalReportData.ts + buildExternalReportData.ts.
// =============================================================================
import { r1 } from "../estimate/mathUtils";
import { stockStatus } from "../estimate/computeUtils";
import {
  PACK, STOCK_LENGTHS, JTRACK_STOCK, JTRACK_DIM, FLASH_STOCK, HORIZ_CTRACK_STOCK, CTRACK_DIM,
  EXT_STOCK, EXT_PACK, EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_CTRACK_STOCK, EXT_JTRACK_STOCK, EXT_ZFLASH_STOCK,
} from "../data";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";
import type { aggregateProject, AggPanelEntry, AggCustomEntry, CTrackAggEntry, ExtAggGroup } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { WALL_SYSTEMS } from "../calculator/wallsCard";
import type { EstimateReportData, WallSummaryRow, PanelGroupRow, TrackLineRow, SealantLine } from "./reportTypes";

const wallSystemLabel = (id: Wall["wallSystem"]) => WALL_SYSTEMS.find(([wid]) => wid === id)?.[1];

function stockStatusLabel(mm: number, stocks: number[]): PanelGroupRow["status"] {
  const s = stockStatus(mm, stocks);
  return s.type === "stocked" ? "Stocked" : s.type === "near-stock" ? "Near stock" : "Custom";
}

function wallRow(wall: Wall, out: ComputeOut, warn: boolean, dimUnit: string, toDisp: (m: string) => string): WallSummaryRow {
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  const isExternal = wall.application === "external";
  return {
    name: wall.name,
    orientation: wall.orient,
    system: !isExternal && wall.orient === "horizontal" ? wallSystemLabel(wall.wallSystem) : undefined,
    panelType: isExternal ? "P78 coloured" : `P${wall.type}`,
    width: dim(wall.width), height: dim(wall.height),
    area: out.empty ? "--" : `${out.area} m2`,
    panels: out.empty ? "--" : String(out.chosen?.panels ?? out.result?.panels ?? "--"),
    warning: warn,
  };
}

export interface ReportDataParams {
  orient: "vertical" | "horizontal"; dimUnit: string;
  toDisp: (m: string) => string;
  walls: Wall[]; results: WallResult[]; warnById: Record<number, boolean>;
  aggProject: ReturnType<typeof aggregateProject>;
  combinedEstimate: CombinedEstimate;
}

export function buildReportData(p: ReportDataParams): EstimateReportData {
  const hasInternal = p.results.some(r => r.wall.application === "internal");
  const hasExternal = p.results.some(r => r.wall.application === "external");
  const orientLabel = p.orient === "vertical" ? "Vertical" : "Horizontal";
  const systemLabel = hasInternal && hasExternal
    ? `Internal + External calculator - ${orientLabel}`
    : hasExternal ? `External calculator - ${orientLabel}` : `Internal calculator - ${orientLabel}`;

  const { internal, external } = p.aggProject;
  const walls = p.results.map(({ wall, out }) => wallRow(wall, out, !!p.warnById[wall.id], p.dimUnit, p.toDisp));

  const panelGroups: PanelGroupRow[] = [
    ...internal.panels.map((g: AggPanelEntry) => ({
      label: `P${g.type} - ${g.label}`,
      status: stockStatusLabel(g.stock * 1000, STOCK_LENGTHS),
      required: g.pieces, packSize: g.ps ?? PACK[g.type], packs: g.packs, ordered: g.ordered, spare: g.spare,
      panelType: g.type,
    })),
    ...external.groups.map((g: ExtAggGroup) => ({
      label: `${r1(g.stock)} m`,
      status: stockStatusLabel(g.stock * 1000, EXT_STOCK),
      required: g.pieces, packSize: EXT_PACK, packs: g.packs, ordered: g.ordered, spare: g.spare,
      panelType: 78, // External only ever supports P78 -- see EXT_* constants, no per-type branching exists.
    })),
  ];
  const customPanels: PanelGroupRow[] = internal.customPanels.map((s: AggCustomEntry) => ({
    label: `P${s.type} - ${s.mm.toLocaleString()} mm`,
    status: stockStatusLabel(s.mm, STOCK_LENGTHS),
    required: s.qty, packSize: s.packSize, packs: s.packs, ordered: s.ordered, spare: s.spare,
    panelType: s.type,
  }));

  const trackLines: TrackLineRow[] = [];
  for (const c of internal.cTracks as CTrackAggEntry[]) {
    trackLines.push({
      label: c.orient === "horizontal" ? `C-track perimeter - P${c.type}` : `C-track vert P${c.type} - ${CTRACK_DIM[c.type]}`,
      pieces: c.pieces, lengthM: c.lm, stockLabel: `stocked @ ${r1(c.stock)} m`,
      kind: "c-track", system: "internal", panelType: c.type,
    });
  }
  if (internal.jLM > 0) trackLines.push({ label: `J-track - ${JTRACK_DIM[78]} - 1.15 mm BMT`, pieces: internal.jPieces, lengthM: internal.jLM, stockLabel: `stocked @ ${r1(JTRACK_STOCK[0])} m`, kind: "j-track", system: "internal", panelType: 78 });
  if (internal.flashLM > 0) trackLines.push({ label: "Head track flashing 0.7 mm BMT x 130 mm GAL", pieces: internal.flashPieces, lengthM: internal.flashLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m`, kind: "head-flash", system: "internal" });
  // No TrackKind mapping exists in the catalog for these four -- left
  // unmatched/unpriced in v1 (see reportTypes.ts's TrackLineRow comment)
  // rather than guessing which catalog row they should borrow pricing from.
  if (internal.vertTrackLM > 0) trackLines.push({ label: "Shaft vertical track (both edges, all shaft walls)", pieces: internal.vertTrackPieces, lengthM: internal.vertTrackLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
  if (internal.cornerPostLM > 0) trackLines.push({ label: "Corner posts (linked pairs)", pieces: internal.cornerPostPieces, lengthM: internal.cornerPostLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
  if (internal.junctionLM > 0) trackLines.push({ label: "Back-to-back junctions (linked pairs)", pieces: internal.junctionPieces, lengthM: internal.junctionLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });
  if (internal.stripLM > 0) trackLines.push({ label: "Protection strips (corner + shaft)", pieces: internal.stripPieces, lengthM: internal.stripLM, stockLabel: `stocked @ ${r1(FLASH_STOCK)} m` });

  if (external.cLM > 0) trackLines.push({ label: "C-track - Head + 2 sides", pieces: external.cPieces, lengthM: external.cLM, stockLabel: `${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`, kind: "c-track", system: "external", panelType: 78 });
  if (external.jLM > 0) trackLines.push({ label: "J-track - Base", pieces: external.jPieces, lengthM: external.jLM, stockLabel: `${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`, kind: "j-track", system: "external", panelType: 78 });
  if (external.zLM > 0) trackLines.push({ label: "Z-flashing (coloured)", pieces: external.zPieces, lengthM: external.zLM, stockLabel: `@ ${r1(EXT_ZFLASH_STOCK)} m`, kind: "z-flash", system: "external", panelType: 78 });
  if (external.flashLM > 0) trackLines.push({ label: "Head track flashing 0.7 mm BMT x 130 mm GAL", pieces: external.flashPieces, lengthM: external.flashLM, stockLabel: `@ ${r1(FLASH_STOCK)} m`, kind: "head-flash", system: "external" });

  // No TrackKind mapping exists for a combined C/J junction line -- left
  // unmatched/unpriced (see reportTypes.ts's TrackLineRow comment). One
  // line for the whole project (combinedEstimate.connections spans every
  // wall regardless of application) -- not split per side, since a junction
  // can link an Internal wall to an External one.
  if (p.combinedEstimate.connectionPieces > 0) trackLines.push({ label: "Extra C/J track (combined wall junctions)", pieces: p.combinedEstimate.connectionPieces, lengthM: p.combinedEstimate.connectionLM, stockLabel: `stocked @ ${r1(HORIZ_CTRACK_STOCK)} m` });

  const extraLines: { label: string; value: string }[] = [];
  if (internal.slabPassSausages > 0) extraLines.push({ label: "Slab-pass sealant", value: `${internal.slabPassSealantBoxes} box(es) (${internal.slabPassSausages} sausages)` });
  if (internal.slabAnchors > 0) extraLines.push({ label: "Slab-edge anchors (by others, not a Speedpanel part)", value: `~${internal.slabAnchors}` });

  // Sealant is a genuinely different product per side -- see this file's
  // header comment. sealantLines always lists every side that actually used
  // sealant (so priceEstimateReportData.ts can price a mixed project
  // correctly); the legacy single sealantLabel/sealantBoxes/sausages fields
  // below stay exactly what a pure Internal or pure External project always
  // produced, for backward compatibility with anything reading those fields
  // directly.
  const sealantLines: SealantLine[] = [];
  if (internal.sealantBoxes > 0) sealantLines.push({ system: "internal", label: "Hilti CP606 sealant", boxes: internal.sealantBoxes, sausages: internal.sausages });
  if (external.sealantBoxes > 0) sealantLines.push({ system: "external", label: "Sikaflex 400 Fire PU", boxes: external.sealantBoxes, sausages: external.sausages });
  const primarySealant = hasInternal
    ? { label: "Hilti CP606 sealant", boxes: internal.sealantBoxes, sausages: internal.sausages, area: internal.totalArea }
    : { label: "Sikaflex 400 Fire PU", boxes: external.sealantBoxes, sausages: external.sausages, area: external.totalArea };

  const notes = Array.from(new Set(p.results.flatMap(r => r.out.notes || [])));
  if (p.results.some(r => r.wall.application === "internal" && r.out.p2pEnhanced)) notes.push("One or more P78 vertical walls > 5.0 m: enhanced panel-to-panel fixing pattern applied.");
  const warnings = Array.from(new Set([...p.results.flatMap(r => r.out.warnings || []), ...p.combinedEstimate.connectionWarnings]));

  return {
    systemLabel, generatedAt: new Date(),
    totals: {
      area: p.aggProject.combined.totalArea, panels: p.aggProject.combined.totalPanels,
      packs: internal.totalPacks + external.packs,
      wastePct: hasInternal && !hasExternal ? internal.wastePct : undefined,
    },
    walls, panelGroups, customPanels, trackLines,
    fixings: {
      fix30: internal.fix30 + external.fix30, boxes30: internal.boxes30 + external.boxes30,
      fix16: internal.fix16 + external.fix16, boxes16: internal.boxes16 + external.boxes16,
      sealantLabel: primarySealant.label, sealantBoxes: primarySealant.boxes, sausages: primarySealant.sausages,
      area: primarySealant.area, extraLines,
      sealantLines,
    },
    connections: p.combinedEstimate.connections.map(c => ({
      wallA: `${c.wallAName} (${c.wallAOrient})`, wallB: `${c.wallBName} (${c.wallBOrient})`,
      lengthM: c.lengthM, quantity: c.quantity, stock: c.stock, pieces: c.pieces, reason: c.reason, warnings: c.warnings,
    })),
    notes, warnings,
  };
}
