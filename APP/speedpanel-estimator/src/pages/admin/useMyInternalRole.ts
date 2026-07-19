// =============================================================================
// My internal staff role + section/action grants -- for client-side Admin
// section gating
// =============================================================================
// profiles.staff_role and role_permissions are back (see supabase/schema.sql
// -- the business layer/dynamic RBAC was restored). staffRole comes straight
// off profiles.staff_role; myPermissions is built from role_permissions
// filtered to that role, readable via its own "Staff can read grants for
// their own role" RLS policy (see schema.sql's "Dynamic RBAC" section) --
// no RPC needed for that path, same as adminSectionAccess.ts's own comment
// already expected once this table existed again. staffRole stays null (not
// an error) for a non-staff account or one with no staff_role assigned yet
// -- canAccessSection's grandfather clause treats that the same as
// super_admin, matching has_staff_role()'s own server-side semantics.
//
// isInternalStaff (profiles.role = 'admin') is unchanged -- still the one
// plain table read, covered by "Users can read own profile" RLS.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { InternalRole } from "../company/staffTypes";

export function useMyInternalRole(userId: string | null): {
  isInternalStaff: boolean;
  staffRole: InternalRole | null;
  myPermissions: ReadonlySet<string>;
  loading: boolean;
} {
  const [isInternalStaff, setIsInternalStaff] = useState(false);
  const [staffRole, setStaffRole] = useState<InternalRole | null>(null);
  const [myPermissions, setMyPermissions] = useState<ReadonlySet<string>>(EMPTY_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: profile } = await supabase!.from("profiles").select("role, staff_role").eq("id", userId).single();
      if (cancelled) return;
      const admin = profile?.role === "admin";
      const role = (profile?.staff_role ?? null) as InternalRole | null;
      setIsInternalStaff(admin);
      setStaffRole(role);

      if (!admin || !role || role === "super_admin") {
        setMyPermissions(EMPTY_PERMISSIONS);
        setLoading(false);
        return;
      }
      const { data: grants } = await supabase!.from("role_permissions").select("permission_key").eq("role", role);
      if (cancelled) return;
      setMyPermissions(new Set((grants ?? []).map((g: { permission_key: string }) => g.permission_key)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return { isInternalStaff, staffRole, myPermissions, loading };
}

const EMPTY_PERMISSIONS: ReadonlySet<string> = new Set();
