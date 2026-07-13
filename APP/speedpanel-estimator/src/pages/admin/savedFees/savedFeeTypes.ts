// =============================================================================
// Admin Saved Fees -- row/entity types
// =============================================================================
// Mirrors saved_fees (see supabase/schema.sql's "Quote Adjustments: Saved
// Fees" section). Same camelCase-entity + snake_case-row + Zod-schema
// convention as productTypes.ts/productMappers.ts and documentTypes.ts/
// documentMappers.ts -- combined into one file here since the shape is
// flat (no nested arrays needing a dedicated mappers file).
// =============================================================================
import { z } from "zod";

export const SAVED_FEE_KINDS = ["delivery", "fee"] as const;
export type SavedFeeKind = typeof SAVED_FEE_KINDS[number];

export interface AdminSavedFee {
  id: string;
  label: string;
  kind: SavedFeeKind;
  defaultAmountExGst?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SavedFeeRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(SAVED_FEE_KINDS),
  default_amount_ex_gst: z.number().nullable(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SavedFeeRow = z.infer<typeof SavedFeeRowSchema>;

export function fromSavedFeeRow(row: SavedFeeRow): AdminSavedFee {
  return {
    id: row.id, label: row.label, kind: row.kind,
    defaultAmountExGst: row.default_amount_ex_gst ?? undefined,
    active: row.active, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function toSavedFeeRow(f: Omit<AdminSavedFee, "id" | "createdAt" | "updatedAt">) {
  return {
    label: f.label, kind: f.kind,
    default_amount_ex_gst: f.defaultAmountExGst ?? null,
    active: f.active,
  };
}
