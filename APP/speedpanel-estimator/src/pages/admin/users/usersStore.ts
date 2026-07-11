// =============================================================================
// Admin Users -- Speedpanel staff directory, live Supabase fetch via
// security definer RPCs
// =============================================================================
// profiles has no email column and auth.users isn't directly queryable via
// PostgREST, so both listing and staff-role changes go through
// admin_list_users()/admin_set_staff_role() (see supabase/schema.sql) --
// both has_staff_role(array[])-gated (super_admin only) server-side, same
// defense-in-depth as review_install/review_technical in
// adminProjectsStore.ts: an unauthenticated or non-super-admin session gets
// an empty list / an error back, never another account's data.
// admin_list_users() itself is also narrowed to role='admin' rows only --
// external/customer accounts are managed exclusively via each company's
// roster on Admin > Companies now, never listed here.
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
// which re-checks has_staff_role(array[]) itself before doing anything
// privileged. Every invite from this page is inherently a new Speedpanel
// hire (role='admin' always) with a required staffRole -- there's no more
// "invite as a plain user" option here.
//
// promoteToStaff() covers the other case: an account that already exists
// (a former customer signup, or one created directly in Supabase) that
// needs to become staff. Since admin_list_users() only ever returns
// role='admin' rows, such an account is otherwise invisible on this page --
// promoteToStaff() looks it up by email and sets role='admin' + staff_role
// in one step (admin_promote_user_to_staff_by_email), after which it shows
// up in the normal list like any other staff account.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { AdminUserRowSchema, type AdminUserRow } from "./userTypes";
import type { InternalRole } from "../../company/staffTypes";

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

  const setStaffRole = async (id: string, staffRole: InternalRole): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_staff_role", { p_user_id: id, p_staff_role: staffRole });
    if (error) return error.message;
    setState(s => ({ ...s, users: s.users.map(u => u.id === id ? { ...u, staff_role: staffRole } : u) }));
    return null;
  };

  // For an EXISTING account (role='user' -- a former customer signup, or one
  // created directly in Supabase) that needs to become staff. admin_set_staff_role
  // above requires role='admin' already, and this page's own list only ever shows
  // role='admin' rows, so a role='user' account is otherwise invisible/unreachable
  // here -- this is the promotion path in, by email instead of a pre-known id.
  const promoteToStaff = async (email: string, staffRole: InternalRole): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_promote_user_to_staff_by_email", { p_email: email, p_staff_role: staffRole });
    if (error) return error.message;
    await load();
    return null;
  };

  // Speedpanel staff contact details (display_name/title/phone) -- only
  // meaningful for role='admin' rows, see AdminUsersPage.tsx's staff-profile
  // edit form and this app's "Assigned Speedpanel Team" feature.
  const setStaffProfile = async (id: string, input: { displayName: string; title: string; phone: string }): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_set_staff_profile", {
      p_user_id: id, p_display_name: input.displayName || null, p_title: input.title || null, p_phone: input.phone || null,
    });
    if (error) return error.message;
    setState(s => ({
      ...s,
      users: s.users.map(u => u.id === id
        ? { ...u, display_name: input.displayName || null, title: input.title || null, phone: input.phone || null }
        : u),
    }));
    return null;
  };

  const inviteUser = async (email: string, staffRole: InternalRole): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.functions.invoke<{ id?: string }>("admin-invite-user", { body: { email, role: "admin", staffRole } });
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

  return { ...state, reload: load, loadMore, setStaffRole, setStaffProfile, inviteUser, promoteToStaff };
}
