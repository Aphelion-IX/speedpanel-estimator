// =============================================================================
// Admin Systems -- Supabase-backed persistence, localStorage fallback
// =============================================================================
// Mirrors requestsStore.ts's live-Supabase pattern: on mount, load both
// systems' rows from the systems_data table (see supabase/schema.sql) so
// edits sync across sessions/devices. When Supabase isn't configured, falls
// back to the same localStorage staging this used before -- see
// isSupabaseConfigured in supabaseClient.ts. Still just two whole-array
// replacements (one per system), matching RepeatableRowEditor's onChange(rows)
// contract; there's no per-row id/CRUD either way.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";
import { buildSeedRows } from "./seedFromLockedData";
import type { LockedRow, SystemId } from "./systemsTypes";

const STORAGE_KEY = "speedpanel:adminSystems";

interface PersistedRows { v: number; internal: LockedRow[]; external: LockedRow[]; }

function loadLocal(): { internal: LockedRow[]; external: LockedRow[] } {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedRows;
        if (p && p.v === 1 && Array.isArray(p.internal) && Array.isArray(p.external)) {
          return { internal: p.internal, external: p.external };
        }
      }
    } catch { /* ignore parse/access errors, fall through to seed */ }
  }
  return { internal: buildSeedRows("internal"), external: buildSeedRows("external") };
}

function saveLocal(internal: LockedRow[], external: LockedRow[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedRows = { v: 1, internal, external };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}

interface SystemsState {
  internal: LockedRow[];
  external: LockedRow[];
  loading: boolean;
  error: string | null;
}

export function useSystemsStore() {
  const [state, setState] = useState<SystemsState>(() =>
    isSupabaseConfigured ? { internal: [], external: [], loading: true, error: null } : { ...loadLocal(), loading: false, error: null },
  );

  const loadFromSupabase = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("systems_data").select("system_id, rows");
    if (error) {
      setState({ ...loadLocal(), loading: false, error: error.message });
      return;
    }
    const bySystem = new Map((data ?? []).map(row => [row.system_id as SystemId, row.rows as LockedRow[]]));
    setState({
      internal: bySystem.get("internal") ?? buildSeedRows("internal"),
      external: bySystem.get("external") ?? buildSeedRows("external"),
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => { if (isSupabaseConfigured) loadFromSupabase(); }, [loadFromSupabase]);

  // Local fallback only -- when Supabase is configured, writes go through
  // setRows/resetToSeed's own upserts below instead.
  useEffect(() => {
    if (!isSupabaseConfigured && !state.loading) saveLocal(state.internal, state.external);
  }, [state.internal, state.external, state.loading]);

  const persist = async (system: SystemId, rows: LockedRow[]): Promise<void> => {
    if (!supabase) return;
    const { error } = await supabase.from("systems_data").upsert({ system_id: system, rows, updated_at: new Date().toISOString() });
    if (error) setState(s => ({ ...s, error: error.message }));
  };

  const setRows = (system: SystemId, rows: LockedRow[]): void => {
    setState(s => ({ ...s, ...(system === "internal" ? { internal: rows } : { external: rows }) }));
    persist(system, rows);
  };

  // QA escape hatch -- discards all edits and restores the data.ts-derived seed.
  const resetToSeed = (): void => {
    const seed = { internal: buildSeedRows("internal"), external: buildSeedRows("external") };
    setState(s => ({ ...s, ...seed }));
    persist("internal", seed.internal);
    persist("external", seed.external);
  };

  return { internal: state.internal, external: state.external, loading: state.loading, error: state.error, setRows, resetToSeed };
}
