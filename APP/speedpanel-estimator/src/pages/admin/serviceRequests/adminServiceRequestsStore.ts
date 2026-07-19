// =============================================================================
// Admin > Support Requests -- live Supabase fetch/triage store
// =============================================================================
// service_requests' own RLS ("Project viewers and staff can read service
// requests", see supabase/schema.sql) already lets anyone holding
// service_requests.manage read every row with a plain select -- no RPC
// needed for the list itself, same "server is the real gate" convention as
// every other admin list in this app. Status/assignment writes still go
// through the security-definer RPCs (admin_update_service_request_status/
// admin_assign_service_request) -- never a bare table update.
// =============================================================================
import { useCallback } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { useAsyncResource } from "../../projects/useAsyncResource";
import { ServiceRequestRowSchema, type ServiceRequestStatus } from "../../projects/services/serviceRequestTypes";

const NOT_CONFIGURED = "Support requests aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

// Embedded resource select via the project_id FK -- same "join in the same
// query, no second round trip" convention as admin/AdminRequestsPage.tsx's
// project_snapshot. Kept a separate schema (not a shared export) since no
// other store needs "service request + its parent project's display fields".
const AdminServiceRequestRowSchema = ServiceRequestRowSchema.extend({
  projects: z.object({ name: z.string(), project_number: z.string().nullable() }).nullable(),
});
export type AdminServiceRequestRow = z.infer<typeof AdminServiceRequestRowSchema>;

export function useAdminServiceRequests() {
  const fetchRequests = useCallback(async (): Promise<{ data: AdminServiceRequestRow[]; error: string | null }> => {
    if (!supabase) return { data: [], error: null };
    const { data, error } = await supabase.from("service_requests")
      .select("*, projects(name, project_number)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { data: [], error: error.message };
    const parsed = AdminServiceRequestRowSchema.array().safeParse(data ?? []);
    return parsed.success ? { data: parsed.data, error: null } : { data: [], error: BAD_SHAPE };
  }, []);

  const { data: requests, loading, error, reload, setData } = useAsyncResource(fetchRequests, [], {
    initialData: [] as AdminServiceRequestRow[],
    skip: !supabase,
    skipError: NOT_CONFIGURED,
  });

  const updateStatus = async (id: string, status: ServiceRequestStatus): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_update_service_request_status", { p_service_request_id: id, p_status: status });
    if (error) return error.message;
    setData(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    return null;
  };

  const assign = async (id: string, staffUserId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_assign_service_request", { p_service_request_id: id, p_staff_user_id: staffUserId });
    if (error) return error.message;
    await reload();
    return null;
  };

  return { requests, loading, error, reload, updateStatus, assign };
}
