// =============================================================================
// Admin Users -- live Supabase fetch via security definer RPCs
// =============================================================================
// profiles has no email column and auth.users isn't directly queryable via
// PostgREST, so both listing and role changes go through admin_list_users()/
// admin_set_role() (see supabase/schema.sql) -- both is_admin()-gated
// server-side, same defense-in-depth as review_install/review_technical in
// adminProjectsStore.ts: an unauthenticated or non-admin session gets an
// empty list / an error back, never another user's data.
//
// inviteUser() is the one exception to "everything here is an RPC" --
// creating a real auth.users row needs the service-role key, which can never
// be shipped to the browser, so it goes through the admin-invite-user Edge
// Function instead (see supabase/functions/admin-invite-user/index.ts),
// which re-checks is_admin() itself before doing anything privileged.
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

  const inviteUser = async (email: string, role: UserRole): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.functions.invoke<{ id?: string }>("admin-invite-user", { body: { email, role } });
    if (error) {
      // A non-2xx response leaves `data` null and `error` a generic
      // FunctionsHttpError whose `.context` is the raw Response -- our
      // function always returns a JSON { error } body in that case, so read
      // it instead of surfacing supabase-js's generic status-code message.
      // context is NOT a Response for other failure modes (e.g. the
      // function isn't deployed / a network error), so guard with
      // `instanceof` rather than assuming the shape.
      const context = (error as { context?: unknown }).context;
      let message = error.message;
      if (context instanceof Response) {
        try {
          const body: { error?: string } = await context.clone().json();
          if (body?.error) message = body.error;
        } catch { /* not JSON -- keep the generic message */ }
      }
      return { id: null, error: message };
    }
    await load();
    return { id: data?.id ?? null, error: null };
  };

  return { ...state, reload: load, setRole, inviteUser };
}
