// =============================================================================
// Admin Customer Overrides -- row types
// =============================================================================
// Mirrors company_product_overrides (see supabase/schema.sql's "Pricing:
// Customer Overrides" section) -- same per-category shape as
// price_list_prices (see ../priceLists/priceListTypes.ts), company_id in
// place of price_list_id. PRICEABLE_CATEGORIES/PriceableCategory are
// re-exported from priceListTypes.ts rather than redefined -- there's only
// one set of priceable categories in this app.
// =============================================================================
import { z } from "zod";
import { PRICEABLE_CATEGORIES } from "../priceLists/priceListTypes";

export { PRICEABLE_CATEGORIES };
export type { PriceableCategory } from "../priceLists/priceListTypes";

export const CompanyOverrideRowSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  category: z.enum(PRICEABLE_CATEGORIES),
  panel_id: z.string().nullable(),
  track_id: z.string().nullable(),
  fixing_id: z.string().nullable(),
  sealant_id: z.string().nullable(),
  price: z.number(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CompanyOverrideRow = z.infer<typeof CompanyOverrideRowSchema>;
