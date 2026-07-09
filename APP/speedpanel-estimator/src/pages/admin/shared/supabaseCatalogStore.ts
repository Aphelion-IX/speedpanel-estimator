// =============================================================================
// Admin -- generic Supabase-backed catalog CRUD
// =============================================================================
// The shared shape behind products/productStore.ts and documents/
// documentStore.ts: fetch a whole table on mount, add/update/remove
// optimistically patch local state on success rather than refetching. Each
// call site is monomorphic (one concrete Row/Entity pair), so there's no
// generic-indexing type hazard here -- that only shows up where a caller
// dispatches across several DIFFERENT tables by a category key (see
// productStore.ts's STORES[category] lookup).
//
// Not used by systemsStore.ts -- LockedRow has no per-row id and the page
// always replaces a whole system's rows at once rather than doing per-row
// add/update/remove, so it needs a different (draft + explicit save) shape
// entirely, not this one.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";

interface CatalogItem { id: string; createdAt: string; updatedAt: string; }

interface CatalogState<Entity> { items: Entity[]; loading: boolean; error: string | null; }

const BAD_SHAPE = "Unexpected data shape from the server.";

export function useSupabaseCatalog<RowSchema extends z.ZodType, Entity extends CatalogItem>(
  table: string,
  rowSchema: RowSchema,
  fromRow: (row: z.infer<RowSchema>) => Entity,
  toRow: (entity: Omit<Entity, "id" | "createdAt" | "updatedAt">) => Record<string, unknown>,
  notConfiguredMessage: string,
  orderBy?: { column: string; ascending: boolean },
) {
  const [state, setState] = useState<CatalogState<Entity>>(() =>
    supabase
      ? { items: [], loading: true, error: null }
      : { items: [], loading: false, error: notConfiguredMessage },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const query = supabase.from(table).select("*");
    const { data, error } = orderBy ? await query.order(orderBy.column, { ascending: orderBy.ascending }) : await query;
    if (error) { setState({ items: [], loading: false, error: error.message }); return; }
    const parsed = rowSchema.array().safeParse(data);
    if (!parsed.success) { setState({ items: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ items: parsed.data.map(fromRow), loading: false, error: null });
  }, [table, rowSchema]);

  useEffect(() => { load(); }, [load]);

  const add = async (item: Omit<Entity, "id" | "createdAt" | "updatedAt">): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: notConfiguredMessage };
    const { data, error } = await supabase.from(table).insert(toRow(item)).select("*").single();
    if (error) return { id: null, error: error.message };
    const parsed = rowSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: BAD_SHAPE };
    const entity = fromRow(parsed.data);
    setState(s => ({ ...s, items: [...s.items, entity] }));
    return { id: entity.id, error: null };
  };

  const update = async (id: string, patch: Partial<Omit<Entity, "id" | "createdAt">>): Promise<string | null> => {
    if (!supabase) return notConfiguredMessage;
    // Merges onto the currently-loaded entity (not just `patch`) before
    // converting to a row -- toRow expects a full entity, and every field it
    // doesn't find would otherwise serialize as an explicit null/undefined
    // (via each mapper's own `?? null`), wrongly clobbering columns the
    // caller never intended to touch.
    const existing = state.items.find(i => i.id === id);
    if (!existing) return "Item not found.";
    const merged = { ...existing, ...patch };
    const now = new Date().toISOString();
    const { error } = await supabase.from(table).update({ ...toRow(merged), updated_at: now }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...patch, updatedAt: now } : i) }));
    return null;
  };

  const remove = async (id: string): Promise<string | null> => {
    if (!supabase) return notConfiguredMessage;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, items: s.items.filter(i => i.id !== id) }));
    return null;
  };

  return { ...state, reload: load, add, update, remove };
}
