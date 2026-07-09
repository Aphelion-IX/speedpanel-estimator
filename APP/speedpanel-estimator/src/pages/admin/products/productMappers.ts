// =============================================================================
// Admin Products -- Supabase row <-> entity mappers
// =============================================================================
// supabase/schema.sql's panels/tracks/fixings/sealants/colours columns are
// snake_case; productTypes.ts's AdminPanel/AdminTrack/etc. are camelCase --
// this is the one place that 1:1 rename happens, both directions, so
// productStore.ts never has to think about column naming.
//
// Row shapes are Zod schemas (not plain interfaces) so productStore.ts can
// validate what actually comes back from Supabase before treating it as a
// trusted AdminPanel/etc. -- catches column-type drift (a migration, a
// manual DB edit) as a reportable error instead of a downstream crash. Each
// XRow type is still `z.infer<typeof XRowSchema>`, so nothing importing the
// *type* needs to change.
// =============================================================================
import { z } from "zod";
import type { AdminPanel, AdminTrack, AdminFixing, AdminSealant, AdminColour } from "./productTypes";

const rowBaseShape = { id: z.string(), created_at: z.string(), updated_at: z.string(), notes: z.string().nullable() };

const spanVertSchema = z.object({ maxW: z.string(), maxH: z.string() });
const spanHorizRowSchema = z.object({ maxW: z.string(), maxH: z.string(), cTrack: z.string(), fix: z.string(), note: z.string().optional() });
const cornerPostBandSchema = z.object({
  maxW: z.number(),
  rows: z.array(z.object({ maxH: z.number(), section: z.string(), fixPerCourse: z.union([z.literal(1), z.literal(2)]).optional() })),
});
const horizCtrackRowSchema = z.object({
  wMax: z.number(), hMax: z.number().nullable(), section: z.string(),
  fix: z.union([z.literal(1), z.literal(2)]), outsideTable: z.boolean().optional(),
});

export const PanelRowSchema = z.object({
  ...rowBaseShape,
  type: z.number(), label: z.string(), depth: z.string(), frl: z.string(), pack: z.number(),
  ctrack_stock: z.number(), ctrack_dim: z.string(), jtrack_dim: z.string(),
  max_h_vert: z.number(), max_h_horiz: z.number(),
  span_vert: spanVertSchema, span_horiz: z.array(spanHorizRowSchema),
  corner_post: z.array(cornerPostBandSchema), horiz_ctrack: z.array(horizCtrackRowSchema),
});
export type PanelRow = z.infer<typeof PanelRowSchema>;

export const TrackRowSchema = z.object({
  ...rowBaseShape,
  kind: z.enum(["c-track", "j-track", "head-flash", "z-flash", "horiz-cover"]),
  system: z.enum(["internal", "external", "both"]), label: z.string(), dim: z.string(),
  bmt: z.string().nullable(), panel_type: z.number().nullable(), stock_lengths: z.array(z.number()),
});
export type TrackRow = z.infer<typeof TrackRowSchema>;

export const FixingRowSchema = z.object({
  ...rowBaseShape,
  code: z.string(), gauge: z.string(), length_mm: z.number(), use: z.string(), per_box: z.number(),
});
export type FixingRow = z.infer<typeof FixingRowSchema>;

export const SealantRowSchema = z.object({
  ...rowBaseShape,
  system: z.enum(["internal", "external"]), product: z.string(), m2_per_sausage: z.number(), per_box: z.number(),
});
export type SealantRow = z.infer<typeof SealantRowSchema>;

export const ColourRowSchema = z.object({ ...rowBaseShape, label: z.string(), code: z.string(), hex: z.string() });
export type ColourRow = z.infer<typeof ColourRowSchema>;

const base = (row: { id: string; created_at: string; updated_at: string; notes: string | null }) =>
  ({ id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, notes: row.notes ?? undefined });

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
