// =============================================================================
// Admin Audit Log -- live Supabase fetch via admin_list_stage_events()
// =============================================================================
// Read-only, no mutations -- see adminProjectsStore.ts for the review actions
// that actually generate these rows. Goes through the security definer RPC
// (see supabase/schema.sql) rather than a direct select on
// project_stage_events, since the RPC also joins in the project name and
// actor email (auth.users isn't otherwise queryable).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminStageEventRowSchema, type AdminStageEventRow } from "./auditLogTypes";

const NOT_CONFIGURED = "Audit log isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface AuditLogState { events: AdminStageEventRow[]; loading: boolean; error: string | null; }

export function useAdminAuditLog() {
  const [state, setState] = useState<AuditLogState>(() =>
    supabase
      ? { events: [], loading: true, error: null }
      : { events: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_stage_events");
    if (error) { setState({ events: [], loading: false, error: error.message }); return; }
    const parsed = AdminStageEventRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ events: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ events: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
