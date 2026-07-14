// =============================================================================
// My internal staff role + section/action grants -- for client-side Admin
// section gating
// =============================================================================
// Two plain table reads (profiles.role/staff_role, then role_permissions for
// that role), both covered by existing RLS -- no RPC needed. profiles rides
// the "Users can read own profile" policy; role_permissions rides the new
// "Staff can read grants for their own role" policy (supabase/schema.sql's
// Dynamic RBAC section). role_permissions is only fetched when staffRole is
// a concrete StaffRole -- null/'super_admin' already bypass everything in
// canAccessSection() (adminSectionAccess.ts), so there's nothing useful to
// fetch for them.
//
// isInternalStaff (profiles.role = 'admin', the same column is_admin() checks
// server-side) is a separate signal from staffRole -- an ordinary external
// customer and an internal admin not yet assigned a specific staff role both
// read back staffRole = null, so staffRole alone can't tell "is this account
// internal staff at all" apart from "is this a customer" (see
// OverviewDashboardPage.tsx, the one caller that needs that distinction).
//
// This is UI-side gating only (which tiles/routes render) -- the real
// security boundary is server-side (has_permission() in supabase/schema.sql,
// applied to the specific RPCs/policies that call it), so a stale or
// not-yet-loaded value here can never grant more than the server would
// actually allow.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { InternalRole } from "../company/staffTypes";
import { STAFF_ROLES, type StaffRole } from "../company/staffTypes";

export function useMyInternalRole(userId: string | null): {
  isInternalStaff: boolean;
  staffRole: InternalRole | null;
  myPermissions: ReadonlySet<string>;
  loading: boolean;
} {
  const [isInternalStaff, setIsInternalStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<InternalRole | null>(null);
  const [myPermissions, setMyPermissions] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("profiles").select("role, staff_role").eq("id", userId).single()
      .then(async (result: { data: { role: string | null; staff_role: string | null } | null }) => {
        if (cancelled) return;
        setIsInternalStaff(result.data?.role === "admin");
        const role = (result.data?.staff_role as InternalRole | null) ?? null;
        setStaffRole(role);

        if (!supabase || !STAFF_ROLES.includes(role as StaffRole)) {
          setMyPermissions(new Set());
          setLoading(false);
          return;
        }
        const { data } = await supabase.from("role_permissions").select("permission_key").eq("role", role);
        if (cancelled) return;
        setMyPermissions(new Set((data ?? []).map((r: { permission_key: string }) => r.permission_key)));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { isInternalStaff, staffRole, myPermissions, loading };
}
