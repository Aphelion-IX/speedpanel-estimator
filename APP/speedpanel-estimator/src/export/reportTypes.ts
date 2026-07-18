// =============================================================================
// Excel report data model
// =============================================================================
// Framework-agnostic shape the Excel workbook builder (./buildWorkbook.ts)
// consumes. Internal and External calculators each have their own adapter
// (./buildInternalReportData.ts, ./buildExternalReportData.ts) that maps
// their existing on-screen state (results, aggregate, combinedEstimate) into
// this common shape, so buildWorkbook itself has no Internal/External branching.
// =============================================================================
import type { TrackKind } from "../pages/admin/products/productTypes";

export interface WallSummaryRow {
  name: string;
  orientation: "vertical" | "horizontal";
  system?: string; // wallSystem label (Internal only) -- e.g. "Corner wall"
  panelType: string; // "P51" / "P78 coloured"
  width: string; height: string; // already display-unit-formatted, e.g. "3.2 m"
  area: string; // "12.3 m2" or "--"
  panels: string; // count or "--"
  warning: boolean;
}

export interface PanelGroupRow {
  label: string; // "P51 - 4.5 m", "4.5 m", or "4500 mm"
  status: "Stocked" | "Near stock" | "Custom";
  required: number;
  packSize: number;
  packs: number;
  ordered: number;
  spare: number;
  // Business key for src/export/priceEstimateReportData.ts's catalog lookup
  // (panels are priced per panel type -- see productTypes.ts's AdminPanel).
  // Always a real panel type (51/64/78), never a display placeholder.
  panelType: number;
}

export interface TrackLineRow {
  label: string;
  pieces: number;
  lengthM: number;
  stockLabel: string;
  // Business key for src/export/priceEstimateReportData.ts's catalog lookup
  // against tracks' (kind, system, panelType) -- see productTypes.ts's
  // AdminTrack. Optional: several track lines (corner posts, shaft vertical
  // track, protection strips, combined-wall-junction "extra" track) have no
  // corresponding TrackKind in the catalog at all -- those omit kind/system
  // and priceEstimateReportData.ts treats them as unmatched/unpriced rather
  // than guessing, same "flag the gap, don't fake a price" call the Orders
  // feature design made deliberately.
  kind?: TrackKind;
  system?: "internal" | "external";
  panelType?: number;
}

export interface FixingsSummary {
  fix30: number; boxes30: number;
  fix16: number; boxes16: number;
  sealantLabel: string; sealantBoxes: number; sausages: number;
  area: number;
  extraLines?: { label: string; value: string }[];
}

export interface ConnectionRow {
  wallA: string; wallB: string;
  lengthM: number; quantity: number; stock: number; pieces: number;
  reason: string; warnings: string[];
}

export interface EstimateReportData {
  systemLabel: string; // e.g. "Internal calculator - Vertical"
  generatedAt: Date;
  totals: { area: number; panels: number; packs?: number; wastePct?: number };
  walls: WallSummaryRow[];
  panelGroups: PanelGroupRow[];
  customPanels: PanelGroupRow[];
  trackLines: TrackLineRow[];
  fixings: FixingsSummary;
  connections: ConnectionRow[];
  notes: string[];
  warnings: string[];
}
