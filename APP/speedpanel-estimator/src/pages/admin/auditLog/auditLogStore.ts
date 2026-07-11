// =============================================================================
// Admin Audit Log -- live Supabase fetch via admin_list_stage_events()
// =============================================================================
// Read-only, no mutations -- see adminProjectsStore.ts for the review actions
// that actually generate these rows. Goes through the security definer RPC
// (see supabase/schema.sql) rather than a direct select on
// project_stage_events, since the RPC also joins in the project name and
// actor email (auth.users isn't otherwise queryable).
//
// Paginated (PAGE_SIZE per page) -- this feed only ever grows, one row per
// install/technical review action, forever, unlike the pending-review-style
// queues elsewhere in Admin.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminStageEventRowSchema, type AdminStageEventRow } from "./auditLogTypes";

const NOT_CONFIGURED = "Audit log isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PAGE_SIZE = 50;

interface AuditLogState { events: AdminStageEventRow[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; }

export function useAdminAuditLog() {
  const [state, setState] = useState<AuditLogState>(() =>
    supabase
      ? { events: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { events: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_stage_events", { p_limit: PAGE_SIZE, p_offset: 0 });
    if (error) { setState({ events: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AdminStageEventRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ events: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ events: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const { data, error } = await supabase.rpc("admin_list_stage_events", { p_limit: PAGE_SIZE, p_offset: state.events.length });
    if (error) { setState(s => ({ ...s, loadingMore: false, error: error.message })); return; }
    const parsed = AdminStageEventRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState(s => ({ ...s, loadingMore: false, error: BAD_SHAPE })); return; }
    setState(s => ({ ...s, events: [...s.events, ...parsed.data], loadingMore: false, hasMore: parsed.data.length === PAGE_SIZE }));
  };

  return { ...state, reload: load, loadMore };
}
