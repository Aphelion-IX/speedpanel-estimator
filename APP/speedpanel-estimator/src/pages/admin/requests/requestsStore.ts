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
//
// Paginated (PAGE_SIZE per page, via .range()) -- unlike AdminProjectsPage's/
// AdminOrdersPage's narrow "awaiting action" queues, this shows every
// request ever submitted regardless of status, so it has no natural bound.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminRequestRowSchema, type AdminRequestRow, type RequestStatus } from "./requestTypes";

const BAD_SHAPE = "Unexpected data shape from the server.";
const NOT_CONFIGURED = "Requests aren't configured for this environment.";
const PAGE_SIZE = 50;

interface RequestsState {
  requests: AdminRequestRow[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
}

export function useAdminRequests() {
  const [state, setState] = useState<RequestsState>(() =>
    supabase
      ? { requests: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { requests: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("requests").select("*")
      .order("created_at", { ascending: false }).range(0, PAGE_SIZE - 1);
    if (error) { setState({ requests: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AdminRequestRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ requests: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ requests: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const from = state.requests.length;
    const { data, error } = await supabase.from("requests").select("*")
      .order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (error) { setState(s => ({ ...s, loadingMore: false, error: error.message })); return; }
    const parsed = AdminRequestRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState(s => ({ ...s, loadingMore: false, error: BAD_SHAPE })); return; }
    setState(s => ({ ...s, requests: [...s.requests, ...parsed.data], loadingMore: false, hasMore: parsed.data.length === PAGE_SIZE }));
  };

  const updateStatus = async (id: string, status: RequestStatus): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("requests").update({ status }).eq("id", id);
    if (error) return error.message;
    setState(s => ({ ...s, requests: s.requests.map(r => r.id === id ? { ...r, status } : r) }));
    return null;
  };

  return { ...state, reload: load, loadMore, updateStatus };
}
