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
// admin_list_users() is paginated (PAGE_SIZE per page, see schema.sql) --
// this roster has no natural upper bound, unlike the pending-review-style
// queues elsewhere in Admin. load() always fetches page 1 (so a freshly
// invited user, sorted newest-first, shows up after inviteUser()'s reload);
// loadMore() appends the next page. Note this means the page's own search
// box (AdminUsersPage.tsx) only searches whatever's been loaded so far, not
// the full roster -- a real server-side search is a bigger feature, left for
// if/when this proves insufficient.
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
const PAGE_SIZE = 50;

interface UsersState { users: AdminUserRow[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; }

export function useAdminUsers() {
  const [state, setState] = useState<UsersState>(() =>
    supabase
      ? { users: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { users: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.rpc("admin_list_users", { p_limit: PAGE_SIZE, p_offset: 0 });
    if (error) { setState({ users: [], loading: false, loadingMore: false, error: error.message, hasMore: false }); return; }
    const parsed = AdminUserRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ users: [], loading: false, loadingMore: false, error: BAD_SHAPE, hasMore: false }); return; }
    setState({ users: parsed.data, loading: false, loadingMore: false, error: null, hasMore: parsed.data.length === PAGE_SIZE });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const { data, error } = await supabase.rpc("admin_list_users", { p_limit: PAGE_SIZE, p_offset: state.users.length });
    if (error) { setState(s => ({ ...s, loadingMore: false, error: error.message })); return; }
    const parsed = AdminUserRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState(s => ({ ...s, loadingMore: false, error: BAD_SHAPE })); return; }
    setState(s => ({ ...s, users: [...s.users, ...parsed.data], loadingMore: false, hasMore: parsed.data.length === PAGE_SIZE }));
  };

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

  return { ...state, reload: load, loadMore, setRole, inviteUser };
}
