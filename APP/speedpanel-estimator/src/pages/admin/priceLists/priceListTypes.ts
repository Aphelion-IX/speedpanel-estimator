// =============================================================================
// Admin Price Lists -- row types
// =============================================================================
// Mirrors price_lists/price_list_prices (see supabase/schema.sql's "Pricing:
// Price Lists" section). Only panel/track/fixing/sealant are priceable --
// colours have no per-unit ordering concept, same restriction productTypes.ts
// already documents for pricePerPanel/pricePerMetre/pricePerBox.
// =============================================================================
import { z } from "zod";

export const PRICEABLE_CATEGORIES = ["panel", "track", "fixing", "sealant"] as const;
export type PriceableCategory = typeof PRICEABLE_CATEGORIES[number];

// admin_list_price_lists() RPC row -- includes product_count/company_count
// so the master list can show both without a second round trip per card.
export const PriceListSummaryRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_default: z.boolean(),
  notes: z.string().nullable(),
  product_count: z.number(),
  company_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PriceListSummaryRow = z.infer<typeof PriceListSummaryRowSchema>;

// Bare price_lists row -- used for the name-only picker on AdminCompaniesPage
// (a plain select, no RPC needed: staff read price_lists via a direct RLS
// policy).
export const PriceListRowSchema = z.object({ id: z.string(), name: z.string(), is_default: z.boolean() });
export type PriceListRow = z.infer<typeof PriceListRowSchema>;

export const PriceListPriceRowSchema = z.object({
  id: z.string(),
  price_list_id: z.string(),
  category: z.enum(PRICEABLE_CATEGORIES),
  panel_id: z.string().nullable(),
  track_id: z.string().nullable(),
  fixing_id: z.string().nullable(),
  sealant_id: z.string().nullable(),
  price: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PriceListPriceRow = z.infer<typeof PriceListPriceRowSchema>;

// The minimal shape applyEffectivePricing()'s buildPriceMap() actually
// needs -- both PriceListPriceRow (price_list_prices) and
// CompanyOverrideRow (company_product_overrides, see
// admin/overrides/overrideTypes.ts) satisfy this structurally, so the same
// merge logic works over either without a runtime adapter.
export interface PriceableProductRow {
  category: PriceableCategory;
  panel_id: string | null;
  track_id: string | null;
  fixing_id: string | null;
  sealant_id: string | null;
  price: number;
}

// The one product id a given price/override row applies to, regardless of
// category -- mirrors the coalesce(panel_id, track_id, fixing_id,
// sealant_id) unique index both price_list_prices and
// company_product_overrides are keyed on.
export function priceRowProductId(row: PriceableProductRow): string {
  return (row.panel_id ?? row.track_id ?? row.fixing_id ?? row.sealant_id)!;
}
