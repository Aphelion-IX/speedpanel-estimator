// =============================================================================
// Admin Roles -- live Supabase fetch/edit for the dynamic permission matrix
// =============================================================================
// admin_list_permission_matrix()/admin_set_role_permission() (see
// supabase/schema.sql) are has_staff_role(array[])-gated (super_admin only)
// server-side, DELIBERATELY not has_permission()-gated like everything else
// this matrix controls -- a role that could edit its own grants could
// self-escalate, and a bad edit could lock out the only page that fixes RBAC
// mistakes. See that migration's own comment for the full reasoning.
//
// setGrant() updates local state optimistically (matching setStaffRole()'s
// convention in ../users/usersStore.ts) rather than reloading the whole
// matrix per toggle -- admin_set_role_permission() is a single-row
// upsert/delete, so the local (role, permissionKey) -> granted flip is
// exactly what the server just did.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { PermissionMatrixRowSchema, type PermissionMatrixRow } from "./roleTypes";
import type { StaffRole } from "../../company/staffTypes";

const NOT_CONFIGURED = "Role management isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface RolesState { rows: PermissionMatrixRow[]; loading: boolean; error: string | null; }

export function useAdminPermissionMatrix() {
  const [state, setState] = useState<RolesState>(() =>
    supabase ? { rows: [], loading: true, error: null } : { rows: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_permission_matrix");
    if (error) { setState({ rows: [], loading: false, error: error.message }); return; }
    const parsed = PermissionMatrixRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ rows: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  const setGrant = async (role: StaffRole, permissionKey: string, granted: boolean): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_role_permission", {
      p_role: role, p_permission_key: permissionKey, p_granted: granted,
    });
    if (error) return error.message;
    setState(s => ({
      ...s,
      rows: s.rows.map(r => r.role === role && r.permission_key === permissionKey ? { ...r, granted } : r),
    }));
    return null;
  };

  return { ...state, reload: load, setGrant };
}
