// =============================================================================
// Admin Analytics -- aggregate counts across every admin-visible table
// =============================================================================
// Read-only overview, no mutations. Catalog table counts use
// {count:'exact', head:true} (rows never fetched, just Content-Range) since
// RLS already makes them public-read; Requests/Projects fetch just the
// status/stage column and group client-side (still admin-gated via RLS) --
// there are few enough rows that a head-only count-per-status query for each
// wouldn't be worth four round trips over one. Users go through
// admin_list_users() (see supabase/schema.sql) since auth.users isn't
// otherwise queryable.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { REQUEST_STATUSES, type RequestStatus } from "../requests/requestTypes";
import { STAGES, type Stage } from "../../projects/projectTypes";

const NOT_CONFIGURED = "Analytics aren't configured for this environment.";

export interface AdminAnalytics {
  catalog: { panels: number; tracks: number; fixings: number; sealants: number; colours: number; documents: number };
  requestsByStatus: Record<RequestStatus, number>;
  requestsTotal: number;
  projectsByStage: Record<Stage, number>;
  projectsTotal: number;
  users: { total: number; admins: number };
}

interface AnalyticsState { data: AdminAnalytics | null; loading: boolean; error: string | null; }

const emptyByStatus = (): Record<RequestStatus, number> =>
  Object.fromEntries(REQUEST_STATUSES.map(s => [s, 0])) as Record<RequestStatus, number>;
const emptyByStage = (): Record<Stage, number> =>
  Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>;

export function useAdminAnalytics() {
  const [state, setState] = useState<AnalyticsState>(() =>
    supabase
      ? { data: null, loading: true, error: null }
      : { data: null, loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState({ data: null, loading: true, error: null });

    const countOf = (table: string) => supabase!.from(table).select("id", { count: "exact", head: true });

    const [panels, tracks, fixings, sealants, colours, documents, requests, projects, users] = await Promise.all([
      countOf("panels"), countOf("tracks"), countOf("fixings"), countOf("sealants"), countOf("colours"), countOf("admin_documents"),
      supabase.from("requests").select("status"),
      supabase.from("projects").select("stage").is("deleted_at", null),
      supabase.rpc("admin_list_users"),
    ]);

    const firstError = [panels, tracks, fixings, sealants, colours, documents, requests, projects, users]
      .find(r => r.error)?.error;
    if (firstError) { setState({ data: null, loading: false, error: firstError.message }); return; }

    const requestsByStatus = emptyByStatus();
    for (const row of (requests.data ?? []) as { status: RequestStatus }[]) requestsByStatus[row.status]++;

    const projectsByStage = emptyByStage();
    for (const row of (projects.data ?? []) as { stage: Stage }[]) projectsByStage[row.stage]++;

    const userRows = (users.data ?? []) as { role: string }[];

    setState({
      data: {
        catalog: {
          panels: panels.count ?? 0, tracks: tracks.count ?? 0, fixings: fixings.count ?? 0,
          sealants: sealants.count ?? 0, colours: colours.count ?? 0, documents: documents.count ?? 0,
        },
        requestsByStatus, requestsTotal: (requests.data ?? []).length,
        projectsByStage, projectsTotal: (projects.data ?? []).length,
        users: { total: userRows.length, admins: userRows.filter(u => u.role === "admin").length },
      },
      loading: false, error: null,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
