// =============================================================================
// Admin Analytics -- aggregate counts across every admin-visible table
// =============================================================================
// Read-only overview, no mutations. Every count here uses
// {count:'exact', head:true} (or the dedicated admin_count_users() RPC) --
// rows are never actually fetched, just the Content-Range header/a single
// aggregate row. Requests/projects used to be fetched whole (just the
// status/stage column) and grouped client-side on the theory that there
// were too few rows for a per-status/per-stage round trip to be worth it --
// that stops being true as the customer base grows, so this is now one
// small head-count query per status/stage value in parallel instead, same
// cost regardless of how large those tables get. Users go through
// admin_count_users() (see supabase/schema.sql) since auth.users isn't
// otherwise queryable, and admin_list_users() itself is paginated now (see
// usersStore.ts) so it can no longer double as a total-count source.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { REQUEST_STATUSES, type RequestStatus } from "../../projects/requests/requestTypes";
import { STAGES, type Stage } from "../../projects/projectTypes";

const NOT_CONFIGURED = "Analytics aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

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
    const countRequestsByStatus = (status: RequestStatus) =>
      supabase!.from("requests").select("id", { count: "exact", head: true }).eq("status", status);
    const countProjectsByStage = (stage: Stage) =>
      supabase!.from("projects").select("id", { count: "exact", head: true }).eq("stage", stage).is("deleted_at", null);

    const [
      panels, tracks, fixings, sealants, colours, documents,
      requestCounts, projectCounts, users,
    ] = await Promise.all([
      countOf("panels"), countOf("tracks"), countOf("fixings"), countOf("sealants"), countOf("colours"), countOf("admin_documents"),
      Promise.all(REQUEST_STATUSES.map(countRequestsByStatus)),
      Promise.all(STAGES.map(countProjectsByStage)),
      supabase.rpc("admin_count_users"),
    ]);

    const firstError = [panels, tracks, fixings, sealants, colours, documents, ...requestCounts, ...projectCounts, users]
      .find(r => r.error)?.error;
    if (firstError) { setState({ data: null, loading: false, error: firstError.message }); return; }

    const requestsByStatus = emptyByStatus();
    REQUEST_STATUSES.forEach((status, i) => { requestsByStatus[status] = requestCounts[i].count ?? 0; });
    const requestsTotal = Object.values(requestsByStatus).reduce((a, b) => a + b, 0);

    const projectsByStage = emptyByStage();
    STAGES.forEach((stage, i) => { projectsByStage[stage] = projectCounts[i].count ?? 0; });
    const projectsTotal = Object.values(projectsByStage).reduce((a, b) => a + b, 0);

    const userCounts = (users.data as { total: number; admins: number }[] | null)?.[0];
    if (!userCounts) { setState({ data: null, loading: false, error: BAD_SHAPE }); return; }

    setState({
      data: {
        catalog: {
          panels: panels.count ?? 0, tracks: tracks.count ?? 0, fixings: fixings.count ?? 0,
          sealants: sealants.count ?? 0, colours: colours.count ?? 0, documents: documents.count ?? 0,
        },
        requestsByStatus, requestsTotal,
        projectsByStage, projectsTotal,
        users: { total: Number(userCounts.total), admins: Number(userCounts.admins) },
      },
      loading: false, error: null,
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
