// =============================================================================
// Admin Requests -- live Supabase fetch
// =============================================================================
// Unlike productStore.ts/documentStore.ts/systemsStore.ts (all localStorage-
// backed staging catalogs), this is a genuine live read: submitted requests
// come from other, anonymous browser sessions, so there's nothing to seed
// locally. Gated by the requests table's "Admins can read/update requests"
// RLS policies (see supabase/schema.sql) -- an unauthenticated or non-admin
// session simply gets an empty/errored result from Supabase. The Admin
// section itself has no sign-in gate, so this is the only thing standing
// between an anonymous visitor and this table's contents.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminRequestRowSchema, type AdminRequestRow, type RequestStatus } from "./requestTypes";

const BAD_SHAPE = "Unexpected data shape from the server.";

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
    if (error) { setState({ requests: [], loading: false, error: error.message }); return; }
    const parsed = AdminRequestRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ requests: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ requests: parsed.data, loading: false, error: null });
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
