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
//
// Scoping is different from the other three queue pages (Project Reviews/
// Orders/Manufacturing, see shared/useMyQueueScope.ts): requests has no
// company_id column at all, only a nullable project_id -> a (also nullable)
// projects.company_id -- a two-hop, partially-unresolvable relationship,
// since an anonymous request with no project_id can never be attributed to
// any company. Unlike the other three queues, there's no "solo/company-less
// row" to protect here -- an unattributable request simply can't appear in
// "mine" mode, since there's no company to attribute it to. That's exactly
// why this is the one queue that keeps a "My companies / All requests"
// toggle (default "mine") rather than always scoping -- a BDM plausibly
// needs occasional visibility into leads the join can't attribute. When
// scoped, the caller's companies' project ids are resolved once, then every
// page fetch filters project_id IN (those ids).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminRequestRowSchema, type AdminRequestRow, type RequestStatus } from "../../projects/requests/requestTypes";
import { useMyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

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

export function useAdminRequests(userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean) {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [scopeMode, setScopeMode] = useState<"mine" | "all">("mine");
  const canToggleScope = scope.kind === "companies";
  const scoped = scope.kind === "companies" && scopeMode === "mine";

  // Resolved once per company set -- the project ids belonging to the
  // caller's companies, so every page fetch can filter on it without
  // re-resolving. null = not yet resolved / not needed (scoped === false).
  const [projectIds, setProjectIds] = useState<string[] | null>(null);
  const companyKey = scope.kind === "companies" ? scope.companyIds.join(",") : "all";

  useEffect(() => {
    if (!supabase || !scoped) { setProjectIds(null); return; }
    if (scope.kind !== "companies") return;
    if (scope.companyIds.length === 0) { setProjectIds([]); return; }
    supabase.from("projects").select("id").in("company_id", scope.companyIds).then(({ data }) => {
      setProjectIds((data ?? []).map(r => (r as { id: string }).id));
    });
  }, [scoped, companyKey]);

  const [state, setState] = useState<RequestsState>(() =>
    supabase
      ? { requests: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { requests: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  // null when the caller's companies resolve to zero projects -- nothing
  // could possibly match, so callers should skip the network round-trip
  // entirely rather than send a query that can only ever return no rows.
  const fetchPage = useCallback((from: number, to: number) => {
    if (scoped && projectIds!.length === 0) return null;
    let query = supabase!.from("requests").select("*");
    if (scoped) query = query.in("project_id", projectIds!);
    return query.order("created_at", { ascending: false }).range(from, to);
  }, [scoped, projectIds]);

  const load = useCallback(async () => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ requests: [], loading: false, loadingMore: false, error: scopeError, hasMore: false }); return; }
    if (scoped && projectIds === null) return; // still resolving the company->project join
    setState(s => ({ ...s, loading: true, error: null }));
    const page = fetchPage(0, PAGE_SIZE - 1);
    if (!page) { setState({ requests: [], loading: false, loadingMore: false, error: null, hasMore: false }); return; }
    const { data, error } = await page;
    if (error) { setState({ requests: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AdminRequestRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ requests: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ requests: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, [scopeLoading, scopeError, scoped, projectIds, fetchPage]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const from = state.requests.length;
    const page = fetchPage(from, from + PAGE_SIZE - 1);
    if (!page) { setState(s => ({ ...s, loadingMore: false, hasMore: false })); return; }
    const { data, error } = await page;
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

  return { ...state, scope, scopeMode, setScopeMode, canToggleScope, reload: load, loadMore, updateStatus };
}
