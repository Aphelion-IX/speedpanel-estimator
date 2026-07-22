// =============================================================================
// Company Accounts & Pricing -- item-level company price overrides (Phase 9)
// =============================================================================
// Backs CompanyPricingTab.tsx. Reads via company_list_price_overrides() (the
// staff-facing full row, has_permission('company_price_overrides.read')-
// gated, security definer -- sees every override regardless of status/date
// and includes internal_reason/created_by/approved_* columns that are
// column-grant-hidden from a direct authenticated select, see
// supabase/schema.sql's "Company Price Overrides" section). Writes via
// admin_set_company_price_override() (upsert -- a current-or-upcoming
// override for the same product is replaced in place, matching the no-
// overlap trigger) / admin_delete_company_price_override(), both
// has_permission('company_price_overrides.write')-gated.
//
// CustomerPricePreview.tsx reads the OTHER, narrower RPC
// (current_company_price_overrides(), already wired into
// applyEffectivePricing.ts's 3rd tier via priceListsStore.ts's
// useEffectivePriceListPrices()) directly -- not this store, which is
// staff-only history/management.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { PRICEABLE_CATEGORIES, type PriceableCategory } from "../../admin/priceLists/priceListTypes";

const NOT_CONFIGURED = "Company price overrides aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const AdminCompanyPriceOverrideRowSchema = z.object({
  id: z.string(),
  category: z.enum(PRICEABLE_CATEGORIES),
  panel_id: z.string().nullable(),
  track_id: z.string().nullable(),
  fixing_id: z.string().nullable(),
  sealant_id: z.string().nullable(),
  override_price: z.number(),
  effective_date: z.string(),
  expiry_date: z.string().nullable(),
  internal_reason: z.string().nullable(),
  created_by: z.string().nullable(),
  created_by_name: z.string().nullable(),
  created_at: z.string(),
  approved_by: z.string().nullable(),
  approved_by_name: z.string().nullable(),
  approved_at: z.string().nullable(),
});
export type AdminCompanyPriceOverrideRow = z.infer<typeof AdminCompanyPriceOverrideRowSchema>;

// Derived, never stored -- matches the plan's confirmed decision that
// Active/Scheduled/Expired is always computed from effective_date/
// expiry_date at read time, same as price_list_versions' own lazy
// scheduled-activation resolver (Phase 8), just client-side here since
// there's no version-swap invariant to protect server-side.
export type OverrideLifecycle = "active" | "scheduled" | "expired";

export function overrideLifecycle(row: AdminCompanyPriceOverrideRow, today = new Date().toISOString().slice(0, 10)): OverrideLifecycle {
  if (row.expiry_date && row.expiry_date < today) return "expired";
  if (row.effective_date > today) return "scheduled";
  return "active";
}

export function overrideProductId(row: { panel_id: string | null; track_id: string | null; fixing_id: string | null; sealant_id: string | null }): string {
  return (row.panel_id ?? row.track_id ?? row.fixing_id ?? row.sealant_id)!;
}

export function useCompanyPriceOverrides(companyId: string | null) {
  const [overrides, setOverrides] = useState<AdminCompanyPriceOverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setOverrides([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("company_list_price_overrides", { p_company_id: companyId });
    if (err) { setError(err.message); setLoading(false); return; }
    const parsed = AdminCompanyPriceOverrideRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
    setOverrides(parsed.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  return { overrides, loading, error, reload: load };
}

export interface CompanyPriceOverrideInput {
  companyId: string;
  category: PriceableCategory;
  productId: string;
  overridePrice: number;
  effectiveDate?: string;
  expiryDate?: string | null;
  internalReason?: string;
}

export async function adminSetCompanyPriceOverride(input: CompanyPriceOverrideInput): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_set_company_price_override", {
    p_company_id: input.companyId,
    p_category: input.category,
    p_product_id: input.productId,
    p_override_price: input.overridePrice,
    p_effective_date: input.effectiveDate || new Date().toISOString().slice(0, 10),
    p_expiry_date: input.expiryDate || null,
    p_internal_reason: input.internalReason || null,
  });
  return error ? error.message : null;
}

export async function adminDeleteCompanyPriceOverride(overrideId: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.rpc("admin_delete_company_price_override", { p_id: overrideId });
  return error ? error.message : null;
}
