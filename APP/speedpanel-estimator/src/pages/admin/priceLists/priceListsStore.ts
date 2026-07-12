// =============================================================================
// Admin Price Lists -- live Supabase fetch
// =============================================================================
// All writes go through the admin_* RPCs (super_admin-gated, see
// supabase/schema.sql) -- price_lists/price_list_prices have no direct
// insert/update/delete RLS policy. Reads are plain selects, gated by each
// table's own staff-read policy, same as productStore.ts's pattern.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import {
  PriceListSummaryRowSchema, PriceListRowSchema, PriceListPriceRowSchema,
  type PriceListSummaryRow, type PriceListRow, type PriceListPriceRow, type PriceableCategory,
} from "./priceListTypes";

const NOT_CONFIGURED = "Price lists aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface PriceListsState { priceLists: PriceListSummaryRow[]; loading: boolean; error: string | null; }

export function useAdminPriceLists() {
  const [state, setState] = useState<PriceListsState>(() =>
    supabase ? { priceLists: [], loading: true, error: null } : { priceLists: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_price_lists");
    if (error) { setState({ priceLists: [], loading: false, error: error.message }); return; }
    const parsed = PriceListSummaryRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ priceLists: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ priceLists: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  const createPriceList = async (name: string, notes?: string): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.rpc("admin_create_price_list", { p_name: name, p_notes: notes || null });
    if (error) return { id: null, error: error.message };
    await load();
    return { id: data as string, error: null };
  };

  const renamePriceList = async (id: string, name: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_rename_price_list", { p_price_list_id: id, p_name: name });
    if (error) return error.message;
    await load();
    return null;
  };

  const duplicatePriceList = async (sourceId: string, newName: string): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.rpc("admin_duplicate_price_list", { p_source_price_list_id: sourceId, p_new_name: newName });
    if (error) return { id: null, error: error.message };
    await load();
    return { id: data as string, error: null };
  };

  const deletePriceList = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_delete_price_list", { p_price_list_id: id });
    if (error) return error.message;
    await load();
    return null;
  };

  return { ...state, reload: load, createPriceList, renamePriceList, duplicatePriceList, deletePriceList };
}

// Name-only picker source -- price_lists' own "Staff can read price lists"
// RLS policy covers this directly, no RPC needed.
export function usePriceListPicker() {
  const [priceLists, setPriceLists] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    supabase.from("price_lists").select("id, name, is_default").order("is_default", { ascending: false }).order("name").then(({ data, error: err }) => {
      if (err) { setError(err.message); setLoading(false); return; }
      const parsed = PriceListRowSchema.array().safeParse(data ?? []);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      setPriceLists(parsed.data);
      setLoading(false);
    });
  }, []);

  return { priceLists, loading, error };
}

interface PriceListPricesState { prices: PriceListPriceRow[]; loading: boolean; error: string | null; }

export function useAdminPriceListPrices(priceListId: string | null) {
  const [state, setState] = useState<PriceListPricesState>({ prices: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || !priceListId) { setState({ prices: [], loading: false, error: supabase ? null : NOT_CONFIGURED }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("price_list_prices").select("*").eq("price_list_id", priceListId);
    if (error) { setState({ prices: [], loading: false, error: error.message }); return; }
    const parsed = PriceListPriceRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ prices: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ prices: parsed.data, loading: false, error: null });
  }, [priceListId]);

  useEffect(() => { load(); }, [load]);

  const setPrice = async (category: PriceableCategory, productId: string, price: number): Promise<string | null> => {
    if (!supabase || !priceListId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_price_list_price", {
      p_price_list_id: priceListId, p_category: category, p_product_id: productId, p_price: price,
    });
    if (error) return error.message;
    await load();
    return null;
  };

  const deletePrice = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_delete_price_list_price", { p_id: id });
    if (error) return error.message;
    setState(s => ({ ...s, prices: s.prices.filter(p => p.id !== id) }));
    return null;
  };

  return { ...state, reload: load, setPrice, deletePrice };
}

// Current price-list assignment for one company, plus the save action --
// powers AdminCompaniesPage.tsx's "Price List" AccordionCard. Reads
// companies.price_list_id directly (staff pass its "Company members can
// read their own company" RLS policy via the is_admin() OR-clause).
export function useCompanyPriceListAssignment(companyId: string) {
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); setError(NOT_CONFIGURED); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.from("companies").select("price_list_id").eq("id", companyId).single();
    if (err) { setError(err.message); setLoading(false); return; }
    setPriceListId((data?.price_list_id as string | null) ?? null);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const save = async (newPriceListId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_company_price_list", { p_company_id: companyId, p_price_list_id: newPriceListId });
    setSaving(false);
    if (error) return error.message;
    setPriceListId(newPriceListId);
    return null;
  };

  return { priceListId, loading, error, saving, save };
}

interface EffectivePricesState { assigned: PriceListPriceRow[]; defaultList: PriceListPriceRow[]; loading: boolean; error: string | null; }

// Powers applyEffectivePricing() at OrderBuilderPage.tsx's one call site --
// the company's own assigned list's prices, plus PL1's (the confirmed
// fallback), fetched client-side rather than via a server-side "effective
// catalog" RPC. Works for a customer (via price_list_prices' company-
// membership + is_default read policies) and for staff alike; companyId
// null (a solo, company-less project) skips the assigned-list lookup and
// resolves against PL1 only.
export function useEffectivePriceListPrices(companyId: string | null) {
  const [state, setState] = useState<EffectivePricesState>({ assigned: [], defaultList: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!supabase) { setState({ assigned: [], defaultList: [], loading: false, error: NOT_CONFIGURED }); return; }
      setState(s => ({ ...s, loading: true, error: null }));

      const { data: defaultRow, error: defaultErr } = await supabase.from("price_lists").select("id").eq("is_default", true).maybeSingle();
      if (cancelled) return;
      if (defaultErr) { setState({ assigned: [], defaultList: [], loading: false, error: defaultErr.message }); return; }
      const defaultId = (defaultRow?.id as string | undefined) ?? null;

      let assignedId: string | null = null;
      if (companyId) {
        const { data: company, error: companyErr } = await supabase.from("companies").select("price_list_id").eq("id", companyId).maybeSingle();
        if (cancelled) return;
        if (companyErr) { setState({ assigned: [], defaultList: [], loading: false, error: companyErr.message }); return; }
        assignedId = (company?.price_list_id as string | null) ?? null;
      }

      const [assignedRes, defaultRes] = await Promise.all([
        assignedId && assignedId !== defaultId
          ? supabase.from("price_list_prices").select("*").eq("price_list_id", assignedId)
          : Promise.resolve({ data: [] as unknown[], error: null }),
        defaultId
          ? supabase.from("price_list_prices").select("*").eq("price_list_id", defaultId)
          : Promise.resolve({ data: [] as unknown[], error: null }),
      ]);
      if (cancelled) return;
      if (assignedRes.error) { setState({ assigned: [], defaultList: [], loading: false, error: assignedRes.error.message }); return; }
      if (defaultRes.error) { setState({ assigned: [], defaultList: [], loading: false, error: defaultRes.error.message }); return; }

      const defaultParsed = PriceListPriceRowSchema.array().safeParse(defaultRes.data ?? []);
      if (!defaultParsed.success) { setState({ assigned: [], defaultList: [], loading: false, error: BAD_SHAPE }); return; }
      const assignedRawRows = assignedId === defaultId ? defaultRes.data : assignedRes.data;
      const assignedParsed = PriceListPriceRowSchema.array().safeParse(assignedRawRows ?? []);
      if (!assignedParsed.success) { setState({ assigned: [], defaultList: [], loading: false, error: BAD_SHAPE }); return; }

      setState({ assigned: assignedParsed.data, defaultList: defaultParsed.data, loading: false, error: null });
    }

    run();
    return () => { cancelled = true; };
  }, [companyId]);

  return state;
}
