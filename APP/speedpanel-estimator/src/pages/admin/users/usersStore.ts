// =============================================================================
// Admin Users -- live Supabase fetch via security definer RPCs
// =============================================================================
// profiles has no email column and auth.users isn't directly queryable via
// PostgREST, so both listing and role changes go through admin_list_users()/
// admin_set_role() (see supabase/schema.sql) -- both is_admin()-gated
// server-side, same defense-in-depth as review_install/review_technical in
// adminProjectsStore.ts: an unauthenticated or non-admin session gets an
// empty list / an error back, never another user's data.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminUserRowSchema, type AdminUserRow, type UserRole } from "./userTypes";

const NOT_CONFIGURED = "User management isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface UsersState { users: AdminUserRow[]; loading: boolean; error: string | null; }

export function useAdminUsers() {
  const [state, setState] = useState<UsersState>(() =>
    supabase
      ? { users: [], loading: true, error: null }
      : { users: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) { setState({ users: [], loading: false, error: error.message }); return; }
    const parsed = AdminUserRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ users: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ users: parsed.data, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  const setRole = async (id: string, role: UserRole): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_role", { p_user_id: id, p_role: role });
    if (error) return error.message;
    setState(s => ({ ...s, users: s.users.map(u => u.id === id ? { ...u, role } : u) }));
    return null;
  };

  return { ...state, reload: load, setRole };
}
