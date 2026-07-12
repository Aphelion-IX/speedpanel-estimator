// =============================================================================
// Admin Customer Overrides -- live Supabase fetch
// =============================================================================
// All writes go through the admin_* RPCs (super_admin-gated, see
// supabase/schema.sql) -- company_product_overrides has no direct
// insert/update/delete RLS policy. Reads are a plain select, gated by the
// table's own staff-or-own-company read policy -- same "no list RPC
// needed" precedent as priceLists/priceListsStore.ts's
// useAdminPriceListPrices.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { CompanyOverrideRowSchema, type CompanyOverrideRow } from "./overrideTypes";
import type { PriceableCategory } from "../priceLists/priceListTypes";

const NOT_CONFIGURED = "Customer overrides aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface OverridesState { overrides: CompanyOverrideRow[]; loading: boolean; error: string | null; }

export function useCompanyOverrides(companyId: string | null) {
  const [state, setState] = useState<OverridesState>({ overrides: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || !companyId) { setState({ overrides: [], loading: false, error: supabase ? null : NOT_CONFIGURED }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("company_product_overrides").select("*").eq("company_id", companyId);
    if (error) { setState({ overrides: [], loading: false, error: error.message }); return; }
    const parsed = CompanyOverrideRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ overrides: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ overrides: parsed.data, loading: false, error: null });
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const setOverride = async (category: PriceableCategory, productId: string, price: number): Promise<string | null> => {
    if (!supabase || !companyId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_company_override", {
      p_company_id: companyId, p_category: category, p_product_id: productId, p_price: price,
    });
    if (error) return error.message;
    await load();
    return null;
  };

  const clearOverride = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_clear_company_override", { p_id: id });
    if (error) return error.message;
    setState(s => ({ ...s, overrides: s.overrides.filter(o => o.id !== id) }));
    return null;
  };

  return { ...state, reload: load, setOverride, clearOverride };
}
