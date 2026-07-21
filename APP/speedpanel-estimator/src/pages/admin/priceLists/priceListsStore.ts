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
  PriceListSummaryRowSchema, PriceListRowSchema, PriceListPriceRowSchema, PriceListVersionRowSchema,
  CompanyPriceOverrideRowSchema,
  priceRowProductId,
  type PriceListSummaryRow, type PriceListRow, type PriceListPriceRow, type PriceableCategory, type CompanyPriceOverrideRow,
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

interface PriceListPricesState {
  prices: PriceListPriceRow[];
  // Phase 6 (Company Accounts & Pricing): which price_list_versions row is
  // currently being shown -- an existing draft if the list has one in
  // progress, else its active version. null only while unresolved/no list
  // selected. AdminPriceListsPage.tsx surfaces versionStatus so an admin
  // can tell "you're editing an unpublished draft" apart from "this is
  // today's live pricing" -- a real behavior change from pre-Phase-6, where
  // every edit here went live immediately.
  versionId: string | null;
  versionStatus: "draft" | "active" | null;
  loading: boolean;
  error: string | null;
}

export function useAdminPriceListPrices(priceListId: string | null) {
  const [state, setState] = useState<PriceListPricesState>({ prices: [], versionId: null, versionStatus: null, loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || !priceListId) {
      setState({ prices: [], versionId: null, versionStatus: null, loading: false, error: supabase ? null : NOT_CONFIGURED });
      return;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data: versionRows, error: vErr } = await supabase
      .from("price_list_versions").select("id, status")
      .eq("price_list_id", priceListId).in("status", ["draft", "active"]);
    if (vErr) { setState({ prices: [], versionId: null, versionStatus: null, loading: false, error: vErr.message }); return; }
    const versionsParsed = PriceListVersionRowSchema.array().safeParse(versionRows ?? []);
    if (!versionsParsed.success) { setState({ prices: [], versionId: null, versionStatus: null, loading: false, error: BAD_SHAPE }); return; }
    const draft = versionsParsed.data.find(v => v.status === "draft");
    const active = versionsParsed.data.find(v => v.status === "active");
    const resolved = draft ?? active ?? null;
    if (!resolved) { setState({ prices: [], versionId: null, versionStatus: null, loading: false, error: null }); return; }

    const { data, error } = await supabase.from("price_list_prices").select("*").eq("price_list_version_id", resolved.id);
    const versionStatus = resolved.status as "draft" | "active";
    if (error) { setState({ prices: [], versionId: resolved.id, versionStatus, loading: false, error: error.message }); return; }
    const parsed = PriceListPriceRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ prices: [], versionId: resolved.id, versionStatus, loading: false, error: BAD_SHAPE }); return; }
    setState({ prices: parsed.data, versionId: resolved.id, versionStatus, loading: false, error: null });
  }, [priceListId]);

  useEffect(() => { load(); }, [load]);

  // First write against a list still showing its active version auto-forks
  // a draft (admin_create_draft_version copies every current price into
  // fresh rows) -- matches AdminPriceListsPage.tsx's Phase 6 stopgap: an
  // edit here never touches a published/active version directly again, it
  // targets a draft that Phase 8's publish flow later makes live.
  const resolveDraftVersionId = async (): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase || !priceListId) return { id: null, error: NOT_CONFIGURED };
    if (state.versionStatus === "draft" && state.versionId) return { id: state.versionId, error: null };
    const { data, error } = await supabase.rpc("admin_create_draft_version", { p_price_list_id: priceListId });
    if (error) return { id: null, error: error.message };
    return { id: data as string, error: null };
  };

  const setPrice = async (category: PriceableCategory, productId: string, price: number): Promise<string | null> => {
    const { id: versionId, error: draftErr } = await resolveDraftVersionId();
    if (draftErr || !versionId) return draftErr ?? NOT_CONFIGURED;
    const { error } = await supabase!.rpc("admin_set_draft_price", {
      p_version_id: versionId, p_category: category, p_product_id: productId, p_price: price,
    });
    if (error) return error.message;
    await load();
    return null;
  };

  // Bulk variant for CSV import (priceListCsv.ts) -- resolves/forks the
  // draft once, then fires every row's RPC in parallel against it and
  // reloads once at the end, instead of setPrice's one-row-at-a-time "await
  // load() after every call" (fine for a single edit, but would mean one
  // full refetch per row for a hundred-plus-row import).
  const setPrices = async (rows: { category: PriceableCategory; productId: string; price: number }[]): Promise<{ successCount: number; errors: string[] }> => {
    const { id: versionId, error: draftErr } = await resolveDraftVersionId();
    if (draftErr || !versionId) return { successCount: 0, errors: [draftErr ?? NOT_CONFIGURED] };
    const results = await Promise.all(rows.map(r =>
      supabase!.rpc("admin_set_draft_price", {
        p_version_id: versionId, p_category: r.category, p_product_id: r.productId, p_price: r.price,
      })
    ));
    const errors = results.flatMap(r => r.error ? [r.error.message] : []);
    await load();
    return { successCount: rows.length - errors.length, errors };
  };

  // A row's id belongs to whichever version load() last resolved. If that's
  // already a draft, admin_delete_draft_price(id) works directly. If it's
  // still the active version, resolveDraftVersionId() forks a full copy
  // first (new ids for every row) -- the caller's stale active-version id
  // no longer identifies anything in the new draft, so the matching row is
  // re-found there by product identity (category + the one non-null
  // panel/track/fixing/sealant id) instead.
  const deletePrice = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    if (state.versionStatus === "draft" && state.versionId) {
      const { error } = await supabase.rpc("admin_delete_draft_price", { p_id: id });
      if (error) return error.message;
      setState(s => ({ ...s, prices: s.prices.filter(p => p.id !== id) }));
      return null;
    }
    const row = state.prices.find(p => p.id === id);
    if (!row) return "Price row not found";
    const productId = priceRowProductId(row);
    const { id: versionId, error: draftErr } = await resolveDraftVersionId();
    if (draftErr || !versionId) return draftErr ?? NOT_CONFIGURED;
    const { data: freshRows, error: freshErr } = await supabase
      .from("price_list_prices").select("*").eq("price_list_version_id", versionId).eq("category", row.category);
    if (freshErr) return freshErr.message;
    const freshParsed = PriceListPriceRowSchema.array().safeParse(freshRows ?? []);
    if (!freshParsed.success) return BAD_SHAPE;
    const match = freshParsed.data.find(r => priceRowProductId(r) === productId);
    if (!match) return "Price row not found in the new draft";
    const { error } = await supabase.rpc("admin_delete_draft_price", { p_id: match.id });
    if (error) return error.message;
    await load();
    return null;
  };

  return { ...state, reload: load, setPrice, setPrices, deletePrice };
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

interface EffectivePricesState {
  overrides: CompanyPriceOverrideRow[]; assigned: PriceListPriceRow[]; defaultList: PriceListPriceRow[];
  loading: boolean; error: string | null;
}
const EMPTY_EFFECTIVE_PRICES: Omit<EffectivePricesState, "loading" | "error"> = { overrides: [], assigned: [], defaultList: [] };

// Powers applyEffectivePricing() at OrderBuilderPage.tsx/QuickOrderPage.tsx's
// call sites -- the company's own item overrides (Phase 9, highest
// priority), its own assigned list's prices, plus PL1's (the confirmed
// fallback), fetched client-side rather than via a server-side "effective
// catalog" RPC. Works for a customer (via price_list_prices'/
// company_price_overrides' company-membership + is_default read policies)
// and for staff alike; companyId null (a solo, company-less project) skips
// both the assigned-list and overrides lookups and resolves against PL1
// only (overrides are always company-scoped, never a PL1-style fallback).
export function useEffectivePriceListPrices(companyId: string | null) {
  const [state, setState] = useState<EffectivePricesState>({ ...EMPTY_EFFECTIVE_PRICES, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!supabase) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: NOT_CONFIGURED }); return; }
      setState(s => ({ ...s, loading: true, error: null }));

      const { data: defaultRow, error: defaultErr } = await supabase.from("price_lists").select("id").eq("is_default", true).maybeSingle();
      if (cancelled) return;
      if (defaultErr) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: defaultErr.message }); return; }
      const defaultId = (defaultRow?.id as string | undefined) ?? null;

      let assignedId: string | null = null;
      if (companyId) {
        const { data: company, error: companyErr } = await supabase.from("companies").select("price_list_id").eq("id", companyId).maybeSingle();
        if (cancelled) return;
        if (companyErr) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: companyErr.message }); return; }
        assignedId = (company?.price_list_id as string | null) ?? null;
      }

      // current_price_list_prices() (Phase 6) resolves each list's ACTIVE
      // version only -- an in-progress draft never leaks into customer-
      // facing order pricing, regardless of what an admin is mid-editing on
      // AdminPriceListsPage.tsx right now. current_company_price_overrides()
      // (Phase 9) has the same "currently in effect only" narrowing built in.
      const [assignedRes, defaultRes, overridesRes] = await Promise.all([
        assignedId && assignedId !== defaultId
          ? supabase.rpc("current_price_list_prices", { p_price_list_id: assignedId })
          : Promise.resolve({ data: [] as unknown[], error: null }),
        defaultId
          ? supabase.rpc("current_price_list_prices", { p_price_list_id: defaultId })
          : Promise.resolve({ data: [] as unknown[], error: null }),
        companyId
          ? supabase.rpc("current_company_price_overrides", { p_company_id: companyId })
          : Promise.resolve({ data: [] as unknown[], error: null }),
      ]);
      if (cancelled) return;
      if (assignedRes.error) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: assignedRes.error.message }); return; }
      if (defaultRes.error) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: defaultRes.error.message }); return; }
      if (overridesRes.error) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: overridesRes.error.message }); return; }

      const defaultParsed = PriceListPriceRowSchema.array().safeParse(defaultRes.data ?? []);
      if (!defaultParsed.success) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: BAD_SHAPE }); return; }
      const assignedRawRows = assignedId === defaultId ? defaultRes.data : assignedRes.data;
      const assignedParsed = PriceListPriceRowSchema.array().safeParse(assignedRawRows ?? []);
      if (!assignedParsed.success) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: BAD_SHAPE }); return; }
      const overridesParsed = CompanyPriceOverrideRowSchema.array().safeParse(overridesRes.data ?? []);
      if (!overridesParsed.success) { setState({ ...EMPTY_EFFECTIVE_PRICES, loading: false, error: BAD_SHAPE }); return; }

      setState({ overrides: overridesParsed.data, assigned: assignedParsed.data, defaultList: defaultParsed.data, loading: false, error: null });
    }

    run();
    return () => { cancelled = true; };
  }, [companyId]);

  return state;
}
