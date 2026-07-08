// =============================================================================
// Admin Requests -- live Supabase fetch
// =============================================================================
// Unlike productStore.ts/documentStore.ts/systemsStore.ts (all localStorage-
// backed staging catalogs), this is a genuine live read: submitted requests
// come from other, anonymous browser sessions, so there's nothing to seed
// locally. Gated by the requests table's "Admins can read/update requests"
// RLS policies (see supabase/schema.sql) -- an unauthenticated or non-admin
// session simply gets an empty/errored result from Supabase, on top of
// AdminGate.tsx already keeping this page unreachable for them.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { AdminRequestRow, RequestStatus } from "./requestTypes";

interface RequestsState {
  requests: AdminRequestRow[];
  loading: boolean;
  error: string | null;
}

export function useAdminRequests() {
  const [state, setState] = useState<RequestsState>(() =>
    supabase
      ? { requests: [], loading: true, error: null }
      : { requests: [], loading: false, error: "Requests aren't configured for this environment." },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
    setState(
      error
        ? { requests: [], loading: false, error: error.message }
        : { requests: (data ?? []) as AdminRequestRow[], loading: false, error: null },
    );
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: RequestStatus): Promise<string | null> => {
    if (!supabase) return "Requests aren't configured for this environment.";
    const { error } = await supabase.from("requests").update({ status }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, requests: s.requests.map(r => r.id === id ? { ...r, status } : r) }));
    return null;
  };

  return { ...state, reload: load, updateStatus };
}
