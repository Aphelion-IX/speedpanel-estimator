// =============================================================================
// Admin Products -- live Supabase fetch
// =============================================================================
// Same live-Supabase-fetch shape as requestsStore.ts/projectsStore.ts: load()
// does a full refetch of all 5 catalog tables, single-row mutations
// optimistically patch local state on success rather than refetching.
// Gated by panels/tracks/fixings/sealants/colours' "Admins can insert/update/
// delete" RLS policies (see supabase/schema.sql) -- an unauthenticated or
// non-admin session gets an error back from Supabase on any write attempt.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { CATEGORY_KEY } from "./productTypes";
import type { ProductCatalog, ProductCategory, CatalogEntityMap } from "./productTypes";
import {
  fromPanelRow, toPanelRow, fromTrackRow, toTrackRow, fromFixingRow, toFixingRow,
  fromSealantRow, toSealantRow, fromColourRow, toColourRow,
  type PanelRow, type TrackRow, type FixingRow, type SealantRow, type ColourRow,
} from "./productMappers";

const NOT_CONFIGURED = "Products aren't configured for this environment.";

const TABLE_FOR: Record<ProductCategory, string> = {
  panel: "panels", track: "tracks", fixing: "fixings", sealant: "sealants", colour: "colours",
};

// Untyped at this lookup boundary on purpose: add<C>/update<C> correlate
// `category: C` with CatalogEntityMap[C] for their own callers just fine, but
// a category-keyed dictionary of 5 differently-shaped toXRow/fromXRow
// functions can't be indexed by a generic C without TS unioning every
// branch's parameter type together (a known indexed-lookup limitation, not a
// real type hazard -- the actual entity/row shapes are still checked at each
// toXRow/fromXRow call site elsewhere). Same "one cast needed at this
// generic-form/typed-store boundary" tradeoff AdminProductsPage.tsx's own
// handleSave already accepts.
type AnyToRow = (item: never) => Record<string, unknown>;
type AnyFromRow = (row: never) => CatalogEntityMap[ProductCategory];
const TO_ROW: Record<ProductCategory, AnyToRow> = {
  panel: toPanelRow as AnyToRow, track: toTrackRow as AnyToRow, fixing: toFixingRow as AnyToRow,
  sealant: toSealantRow as AnyToRow, colour: toColourRow as AnyToRow,
};
const FROM_ROW: Record<ProductCategory, AnyFromRow> = {
  panel: fromPanelRow as AnyFromRow, track: fromTrackRow as AnyFromRow, fixing: fromFixingRow as AnyFromRow,
  sealant: fromSealantRow as AnyFromRow, colour: fromColourRow as AnyFromRow,
};

interface ProductState { catalog: ProductCatalog; loading: boolean; error: string | null; }

const emptyCatalog: ProductCatalog = { panels: [], tracks: [], fixings: [], sealants: [], colours: [] };

export function useProductStore() {
  const [state, setState] = useState<ProductState>(() =>
    supabase
      ? { catalog: emptyCatalog, loading: true, error: null }
      : { catalog: emptyCatalog, loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const [panels, tracks, fixings, sealants, colours] = await Promise.all([
      supabase.from("panels").select("*"),
      supabase.from("tracks").select("*"),
      supabase.from("fixings").select("*"),
      supabase.from("sealants").select("*"),
      supabase.from("colours").select("*"),
    ]);
    const error = panels.error || tracks.error || fixings.error || sealants.error || colours.error;
    if (error) { setState({ catalog: emptyCatalog, loading: false, error: error.message }); return; }
    setState({
      catalog: {
        panels: (panels.data as PanelRow[]).map(fromPanelRow),
        tracks: (tracks.data as TrackRow[]).map(fromTrackRow),
        fixings: (fixings.data as FixingRow[]).map(fromFixingRow),
        sealants: (sealants.data as SealantRow[]).map(fromSealantRow),
        colours: (colours.data as ColourRow[]).map(fromColourRow),
      },
      loading: false, error: null,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async <C extends ProductCategory>(
    category: C, item: Omit<CatalogEntityMap[C], "id" | "createdAt" | "updatedAt">,
  ): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.from(TABLE_FOR[category])
      .insert(TO_ROW[category](item as never)).select("*").single();
    if (error) return { id: null, error: error.message };
    const entity = FROM_ROW[category](data as never) as CatalogEntityMap[C];
    setState(s => ({
      ...s,
      catalog: { ...s.catalog, [CATEGORY_KEY[category]]: [...(s.catalog[CATEGORY_KEY[category]] as CatalogEntityMap[C][]), entity] },
    }));
    return { id: entity.id, error: null };
  };

  const update = async <C extends ProductCategory>(
    category: C, id: string, patch: Partial<Omit<CatalogEntityMap[C], "id" | "createdAt">>,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    // Merges onto the currently-loaded entity (not just `patch`) before
    // converting to a row -- toXRow expects a full entity, and every field
    // it doesn't find would otherwise serialize as an explicit null/undefined
    // (via each mapper's `?? null`), wrongly clobbering columns the caller
    // never intended to touch. Same "merge onto existing item" semantics the
    // old localStorage version used (`{ ...item, ...patch }`).
    const list = state.catalog[CATEGORY_KEY[category]] as CatalogEntityMap[C][];
    const existing = list.find(item => item.id === id);
    if (!existing) return "Item not found.";
    const merged = { ...existing, ...patch };
    const now = new Date().toISOString();
    const { error } = await supabase.from(TABLE_FOR[category])
      .update({ ...TO_ROW[category](merged as never), updated_at: now }).eq("id", id);
    if (error) return error.message;
    setState(s => {
      const l = s.catalog[CATEGORY_KEY[category]] as CatalogEntityMap[C][];
      return { ...s, catalog: { ...s.catalog, [CATEGORY_KEY[category]]: l.map(item => item.id === id ? { ...item, ...patch, updatedAt: now } : item) } };
    });
    return null;
  };

  const remove = async (category: ProductCategory, id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from(TABLE_FOR[category]).delete().eq("id", id);
    if (error) return error.message;
    setState(s => {
      const list = s.catalog[CATEGORY_KEY[category]] as { id: string }[];
      return { ...s, catalog: { ...s.catalog, [CATEGORY_KEY[category]]: list.filter(item => item.id !== id) } };
    });
    return null;
  };

  return { ...state, reload: load, add, update, remove };
}
