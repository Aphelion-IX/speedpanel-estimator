// =============================================================================
// Admin Documents -- live Supabase fetch
// =============================================================================
// Same live-Supabase-fetch shape as products/productStore.ts: load() does a
// full refetch of admin_documents, single-row mutations optimistically patch
// local state on success rather than refetching. Gated by admin_documents'
// "Admins can insert/update/delete" RLS policies (see supabase/schema.sql).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { AdminDocument } from "./documentTypes";
import { fromDocumentRow, toDocumentRow, type AdminDocumentRow } from "./documentMappers";

const NOT_CONFIGURED = "Documents aren't configured for this environment.";

interface DocumentsState { documents: AdminDocument[]; loading: boolean; error: string | null; }

export function useDocumentStore() {
  const [state, setState] = useState<DocumentsState>(() =>
    supabase
      ? { documents: [], loading: true, error: null }
      : { documents: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("admin_documents").select("*").order("created_at", { ascending: true });
    setState(
      error
        ? { documents: [], loading: false, error: error.message }
        : { documents: (data as AdminDocumentRow[]).map(fromDocumentRow), loading: false, error: null },
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (item: Omit<AdminDocument, "id" | "createdAt" | "updatedAt">): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.from("admin_documents").insert(toDocumentRow(item)).select("*").single();
    if (error) return { id: null, error: error.message };
    const entity = fromDocumentRow(data as AdminDocumentRow);
    setState(s => ({ ...s, documents: [...s.documents, entity] }));
    return { id: entity.id, error: null };
  };

  const update = async (id: string, patch: Partial<Omit<AdminDocument, "id" | "createdAt">>): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    // Merge onto the existing entity first -- see productStore.ts's update()
    // for why toDocumentRow needs a full entity, not a sparse patch.
    const existing = state.documents.find(d => d.id === id);
    if (!existing) return "Item not found.";
    const merged = { ...existing, ...patch };
    const now = new Date().toISOString();
    const { error } = await supabase.from("admin_documents").update({ ...toDocumentRow(merged), updated_at: now }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, documents: s.documents.map(d => d.id === id ? { ...d, ...patch, updatedAt: now } : d) }));
    return null;
  };

  const remove = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("admin_documents").delete().eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, documents: s.documents.filter(d => d.id !== id) }));
    return null;
  };

  return { ...state, reload: load, add, update, remove };
}
