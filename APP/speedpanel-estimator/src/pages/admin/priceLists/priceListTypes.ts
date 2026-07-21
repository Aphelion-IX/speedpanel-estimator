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

// Bare price_list_versions row -- used by priceListsStore.ts's
// useAdminPriceListPrices() to resolve which version (an existing draft, if
// any, else the active one) a price list's admin editor should show/target.
export const PriceListVersionRowSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "scheduled", "active", "expired", "archived"]),
});
export type PriceListVersionRow = z.infer<typeof PriceListVersionRowSchema>;

export const PriceListPriceRowSchema = z.object({
  id: z.string(),
  price_list_version_id: z.string(),
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

// The one product id a given price row applies to, regardless of category --
// mirrors the coalesce(panel_id, track_id, fixing_id, sealant_id) unique
// index price_list_prices itself is keyed on.
export function priceRowProductId(row: PriceListPriceRow): string {
  return (row.panel_id ?? row.track_id ?? row.fixing_id ?? row.sealant_id)!;
}
