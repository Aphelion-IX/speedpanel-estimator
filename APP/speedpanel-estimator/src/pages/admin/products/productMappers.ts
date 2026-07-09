// =============================================================================
// Admin Products -- Supabase row <-> entity mappers
// =============================================================================
// supabase/schema.sql's panels/tracks/fixings/sealants/colours columns are
// snake_case; productTypes.ts's AdminPanel/AdminTrack/etc. are camelCase --
// this is the one place that 1:1 rename happens, both directions, so
// productStore.ts never has to think about column naming.
// =============================================================================
import type { AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour, TrackKind } from "./productTypes";

interface RowBase { id: string; created_at: string; updated_at: string; notes: string | null; }

export interface PanelRow extends RowBase {
  type: number; label: string; depth: string; frl: string; pack: number;
  ctrack_stock: number; ctrack_dim: string; jtrack_dim: string;
  max_h_vert: number; max_h_horiz: number;
  span_vert: AdminPanel["spanVert"]; span_horiz: AdminPanel["spanHoriz"];
  corner_post: AdminPanel["cornerPost"]; horiz_ctrack: AdminPanel["horizCtrack"];
}

export interface TrackRow extends RowBase {
  kind: TrackKind; system: AdminTrack["system"]; label: string; dim: string;
  bmt: string | null; panel_type: number | null; stock_lengths: number[];
}

export interface FixingRow extends RowBase {
  code: string; gauge: string; length_mm: number; use: string; per_box: number;
}

export interface SealantRow extends RowBase {
  system: AdminSealant["system"]; product: string; m2_per_sausage: number; per_box: number;
}

export interface ColourRow extends RowBase {
  label: string; code: string; hex: string;
}

const base = (row: RowBase) => ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, notes: row.notes ?? undefined });

export function fromPanelRow(row: PanelRow): AdminPanel {
  return {
    ...base(row), type: row.type, label: row.label, depth: row.depth, frl: row.frl, pack: row.pack,
    ctrackStock: row.ctrack_stock, ctrackDim: row.ctrack_dim, jtrackDim: row.jtrack_dim,
    maxHVert: row.max_h_vert, maxHHoriz: row.max_h_horiz,
    spanVert: row.span_vert, spanHoriz: row.span_horiz, cornerPost: row.corner_post, horizCtrack: row.horiz_ctrack,
  };
}

export function toPanelRow(p: Omit<AdminPanel, "id" | "createdAt" | "updatedAt">) {
  return {
    notes: p.notes ?? null, type: p.type, label: p.label, depth: p.depth, frl: p.frl, pack: p.pack,
    ctrack_stock: p.ctrackStock, ctrack_dim: p.ctrackDim, jtrack_dim: p.jtrackDim,
    max_h_vert: p.maxHVert, max_h_horiz: p.maxHHoriz,
    span_vert: p.spanVert, span_horiz: p.spanHoriz, corner_post: p.cornerPost, horiz_ctrack: p.horizCtrack,
  };
}

export function fromTrackRow(row: TrackRow): AdminTrack {
  return {
    ...base(row), kind: row.kind, system: row.system, label: row.label, dim: row.dim,
    bmt: row.bmt ?? undefined, panelType: row.panel_type ?? undefined, stockLengths: row.stock_lengths,
  };
}

export function toTrackRow(t: Omit<AdminTrack, "id" | "createdAt" | "updatedAt">) {
  return {
    notes: t.notes ?? null, kind: t.kind, system: t.system, label: t.label, dim: t.dim,
    bmt: t.bmt ?? null, panel_type: t.panelType ?? null, stock_lengths: t.stockLengths,
  };
}

export function fromFixingRow(row: FixingRow): AdminFixing {
  return { ...base(row), code: row.code, gauge: row.gauge, lengthMm: row.length_mm, use: row.use, perBox: row.per_box };
}

export function toFixingRow(f: Omit<AdminFixing, "id" | "createdAt" | "updatedAt">) {
  return { notes: f.notes ?? null, code: f.code, gauge: f.gauge, length_mm: f.lengthMm, use: f.use, per_box: f.perBox };
}

export function fromSealantRow(row: SealantRow): AdminSealant {
  return { ...base(row), system: row.system, product: row.product, m2PerSausage: row.m2_per_sausage, perBox: row.per_box };
}

export function toSealantRow(s: Omit<AdminSealant, "id" | "createdAt" | "updatedAt">) {
  return { notes: s.notes ?? null, system: s.system, product: s.product, m2_per_sausage: s.m2PerSausage, per_box: s.perBox };
}

export function fromColourRow(row: ColourRow): AdminColour {
  return { ...base(row), label: row.label, code: row.code, hex: row.hex };
}

export function toColourRow(c: Omit<AdminColour, "id" | "createdAt" | "updatedAt">) {
  return { notes: c.notes ?? null, label: c.label, code: c.code, hex: c.hex };
}
