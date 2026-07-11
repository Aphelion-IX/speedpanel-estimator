// =============================================================================
// Admin Maths -- cross-device Supabase sync, layered over the existing
// localStorage-based systemTables.ts
// =============================================================================
// Direct structural mirror of mathConstantsStore.ts, for the corner-post /
// horizontal-C-track / shaft-track decision tables instead of scalar
// constants -- see systemTables.ts for why the same synchronous-read contract
// applies (data.ts reads these once at module-eval time, before React even
// mounts). save()/resetToDefaults() write to both Supabase and localStorage.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { loadSystemTables, saveSystemTables, SYSTEM_TABLES_DEFAULTS, SystemTablesSchema, type SystemTables } from "../../../systemTables";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000002";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PartialSystemTablesSchema = SystemTablesSchema.partial();

export function useSystemTablesStore() {
  const [draft, setDraft] = useState<SystemTables>(loadSystemTables);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("system_tables").select("values").eq("id", SINGLETON_ID).single();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const parsed = PartialSystemTablesSchema.safeParse(data?.values);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      const merged = { ...SYSTEM_TABLES_DEFAULTS, ...parsed.data };
      saveSystemTables(merged);
      setDraft(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (values: SystemTables): Promise<string | null> => {
    // Local persistence always succeeds regardless of Supabase configuration
    // (matching systemTables.ts's original, Supabase-agnostic contract) --
    // Supabase is an additional cross-device sync layer on top, not a
    // replacement for it, so its absence/failure never blocks a local save.
    // The sync attempt is wrapped in try/catch (not just a returned {error})
    // since a network failure throws rather than resolving -- without this,
    // an unreachable Supabase would skip saveSystemTables() entirely and
    // silently discard the admin's edit instead of just failing to sync it.
    let syncError: string | null = null;
    if (supabase) {
      try {
        const { error } = await supabase.from("system_tables")
          .update({ values, updated_at: new Date().toISOString() }).eq("id", SINGLETON_ID);
        if (error) syncError = error.message;
      } catch (e) {
        syncError = e instanceof Error ? e.message : "Failed to sync to the server.";
      }
    }
    saveSystemTables(values);
    setDraft(values);
    return syncError;
  };

  const resetToDefaults = () => save(SYSTEM_TABLES_DEFAULTS);

  return { draft, loading, error, save, resetToDefaults };
}
