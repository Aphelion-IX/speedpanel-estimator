// =============================================================================
// Excel report data model
// =============================================================================
// Framework-agnostic shape the Excel workbook builder (./buildWorkbook.ts)
// consumes. Internal and External calculators each have their own adapter
// (./buildInternalReportData.ts, ./buildExternalReportData.ts) that maps
// their existing on-screen state (results, aggregate, combinedEstimate) into
// this common shape, so buildWorkbook itself has no Internal/External branching.
// =============================================================================

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
}

export interface TrackLineRow {
  label: string;
  pieces: number;
  lengthM: number;
  stockLabel: string;
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
  modeLabel: "Project" | "Single wall";
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
