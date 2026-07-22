// =============================================================================
// Company Accounts & Pricing -- Audit History live Supabase fetch
// =============================================================================
// Same paginated shape as admin/auditLog/auditLogStore.ts's
// useAdminAuditLog() (this feed only ever grows too, one row per logged
// action, forever), through admin_list_audit_log() -- a security definer
// RPC, not a direct select, since it joins in company/actor/target/project
// display names (auth.users isn't otherwise queryable) and is gated by the
// new audit.list_all permission (super_admin-only by default, same as
// companies.list). companyId/eventType filters reset pagination and reload
// from offset 0 rather than filtering the already-loaded page client-side --
// this feed can be large, unlike the "dozens, not thousands" company list.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminAuditLogRowSchema, type AdminAuditLogRow } from "./auditTypes";

const NOT_CONFIGURED = "Audit history isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PAGE_SIZE = 50;

interface AuditHistoryState { events: AdminAuditLogRow[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; }

export function useAdminAuditHistory(companyId: string | null, eventType: string | null) {
  const [state, setState] = useState<AuditHistoryState>(() =>
    supabase
      ? { events: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { events: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_audit_log", {
      p_company_id: companyId, p_event_type: eventType, p_limit: PAGE_SIZE, p_offset: 0,
    });
    if (error) { setState({ events: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AdminAuditLogRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ events: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ events: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, [companyId, eventType]);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const { data, error } = await supabase.rpc("admin_list_audit_log", {
      p_company_id: companyId, p_event_type: eventType, p_limit: PAGE_SIZE, p_offset: state.events.length,
    });
    if (error) { setState(s => ({ ...s, loadingMore: false, error: error.message })); return; }
    const parsed = AdminAuditLogRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState(s => ({ ...s, loadingMore: false, error: BAD_SHAPE })); return; }
    setState(s => ({ ...s, events: [...s.events, ...parsed.data], loadingMore: false, hasMore: parsed.data.length === PAGE_SIZE }));
  };

  return { ...state, reload: load, loadMore };
}
