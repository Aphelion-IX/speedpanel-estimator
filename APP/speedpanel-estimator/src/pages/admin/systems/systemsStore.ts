// =============================================================================
// Admin Systems -- live Supabase fetch, local-draft edits
// =============================================================================
// Fetches both system_locked_rows on mount into a local DRAFT the page edits.
// setRows(system, rows) stays a synchronous, local-only mutation -- unchanged
// call signature from AdminSystemsPage.tsx's perspective -- because
// RepeatableRowEditor fires onChange on every keystroke; wiring that straight
// to a network write would fire a request per character. save(system) is the
// only thing that persists (a single atomic `update ... set rows = $1`, see
// supabase/schema.sql's system_locked_rows design note), called from an
// explicit Save button; discard(system) reverts the draft to the last
// fetched/saved rows. Gated by system_locked_rows' "Admins can update" RLS
// policy.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SystemLockedRowsRowSchema, type LockedRow, type SystemId } from "./systemsTypes";

const NOT_CONFIGURED = "Systems aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface SystemsState {
  internal: LockedRow[]; external: LockedRow[];
  saved: { internal: LockedRow[]; external: LockedRow[] };
  loading: boolean; error: string | null;
}

const emptyRows: SystemsState["saved"] = { internal: [], external: [] };

export function useSystemsStore() {
  const [state, setState] = useState<SystemsState>(() =>
    supabase
      ? { internal: [], external: [], saved: emptyRows, loading: true, error: null }
      : { internal: [], external: [], saved: emptyRows, loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("system_locked_rows").select("system, rows");
    if (error) { setState({ internal: [], external: [], saved: emptyRows, loading: false, error: error.message }); return; }
    const parsed = SystemLockedRowsRowSchema.array().safeParse(data);
    if (!parsed.success) { setState({ internal: [], external: [], saved: emptyRows, loading: false, error: BAD_SHAPE }); return; }
    const internal = parsed.data.find(r => r.system === "internal")?.rows ?? [];
    const external = parsed.data.find(r => r.system === "external")?.rows ?? [];
    setState({ internal, external, saved: { internal, external }, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  const setRows = (system: SystemId, rows: LockedRow[]): void => {
    setState(s => ({ ...s, [system]: rows }));
  };

  const dirty = { internal: state.internal !== state.saved.internal, external: state.external !== state.saved.external };

  const save = async (system: SystemId): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const rows = state[system];
    const { error } = await supabase.from("system_locked_rows")
      .update({ rows, updated_at: new Date().toISOString() }).eq("system", system);
    if (error) return error.message;
    setState(s => ({ ...s, saved: { ...s.saved, [system]: rows } }));
    return null;
  };

  const discard = (system: SystemId): void => {
    setState(s => ({ ...s, [system]: s.saved[system] }));
  };

  return { internal: state.internal, external: state.external, loading: state.loading, error: state.error, dirty, reload: load, setRows, save, discard };
}
