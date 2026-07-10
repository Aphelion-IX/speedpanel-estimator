// =============================================================================
// Admin Products -- catalog entity types
// =============================================================================
// Deliberately independent of src/data.ts's PanelSpec/SystemConfig -- this is a
// separate, parallel admin dataset that exists purely so admins can
// browse/stage catalog data via Supabase. Editing these types can never
// affect the compute engine's types.
// =============================================================================
export type ProductCategory = "panel" | "track" | "fixing" | "sealant" | "colour";

interface CatalogEntity { id: string; createdAt: string; updatedAt: string; notes?: string; }

export interface AdminPanel extends CatalogEntity {
  type: number; label: string; depth: string; frl: string; pack: number;
  ctrackStock: number; ctrackDim: string; jtrackDim: string;
  maxHVert: number; maxHHoriz: number;
  spanVert: { maxW: string; maxH: string };
  spanHoriz: { maxW: string; maxH: string; cTrack: string; fix: string; note?: string }[];
  cornerPost: { maxW: number; rows: { maxH: number; section: string; fixPerCourse?: 1 | 2 }[] }[];
  // hMax is nullable, not just number: it mirrors src/data.ts's PanelSpec
  // (whose own outsideTable/no-ceiling row uses hMax: Infinity), but jsonb/
  // JSON has no representation for Infinity -- JSON.stringify silently turns
  // it into null, and that's what's actually stored/read back from Supabase.
  // This catalog is display-only staging data (see this file's own header
  // comment) and never feeds the live calculator, so the null never reaches
  // any real span lookup -- src/estimate/spanLookups.ts reads data.ts's
  // in-memory PANELS directly, not this table.
  horizCtrack: { wMax: number; hMax: number | null; section: string; fix: 1 | 2; outsideTable?: boolean }[];
  // Per panel -- undefined means "not priced yet", not $0. Used by
  // src/export/priceEstimateReportData.ts to price Orders line items.
  pricePerPanel?: number;
}

export type TrackKind = "c-track" | "j-track" | "head-flash" | "z-flash" | "horiz-cover";
export interface AdminTrack extends CatalogEntity {
  kind: TrackKind; system: "internal" | "external" | "both"; label: string; dim: string;
  bmt?: string; panelType?: number; stockLengths: number[];
  // Per linear metre -- undefined means "not priced yet", not $0. Used by
  // src/export/priceEstimateReportData.ts to price Orders line items.
  pricePerMetre?: number;
}

export interface AdminFixing extends CatalogEntity {
  code: string; gauge: string; lengthMm: number; use: string; perBox: number;
  pricePerBox?: number;
}

export interface AdminSealant extends CatalogEntity {
  system: "internal" | "external"; product: string; m2PerSausage: number; perBox: number;
  pricePerBox?: number;
}

export interface AdminColour extends CatalogEntity {
  label: string; code: string; hex: string;
}

export interface ProductCatalog {
  panels: AdminPanel[]; tracks: AdminTrack[]; fixings: AdminFixing[];
  sealants: AdminSealant[]; colours: AdminColour[];
}

// Maps each category to its entity type -- used by productStore.ts's generic
// add/update helpers and by productDetailPanel.tsx's per-category forms.
export interface CatalogEntityMap {
  panel: AdminPanel; track: AdminTrack; fixing: AdminFixing; sealant: AdminSealant; colour: AdminColour;
}

// Maps each category to its ProductCatalog array key.
export const CATEGORY_KEY: { [K in ProductCategory]: keyof ProductCatalog } = {
  panel: "panels", track: "tracks", fixing: "fixings", sealant: "sealants", colour: "colours",
};

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  panel: "Panels", track: "Tracks", fixing: "Fixings", sealant: "Sealant", colour: "Colours",
};
