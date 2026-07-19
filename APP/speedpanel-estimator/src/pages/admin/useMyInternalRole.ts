// =============================================================================
// My internal staff role + section/action grants -- for client-side Admin
// section gating
// =============================================================================
// profiles.staff_role and role_permissions no longer exist (see
// supabase/schema.sql -- the fine-grained internal-role/permissions system
// was deleted along with the rest of the business layer, calculator-only
// tables are all that's left). staffRole/myPermissions are kept as fixed
// null/empty rather than removed from this hook's return shape, so every
// existing caller (AuthStatus.tsx, adminSectionAccess.ts's canAccessSection,
// OverviewDashboardPage.tsx) keeps working unchanged -- canAccessSection's
// own "myRole === null -> always allowed" fallback means a fixed null here
// makes every Admin section reachable for any profiles.role = 'admin'
// account, which is exactly the "no more tiers, one admin role" reality now.
//
// isInternalStaff (profiles.role = 'admin', the same column is_admin() used
// to check server-side before that function was deleted too) is the one
// real signal left -- still a single plain table read, covered by the
// existing "Users can read own profile" RLS policy.
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("profiles").select("role").eq("id", userId).single()
      .then((result: { data: { role: string | null } | null }) => {
        if (cancelled) return;
        setIsInternalStaff(result.data?.role === "admin");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { isInternalStaff, staffRole: null, myPermissions: EMPTY_PERMISSIONS, loading };
}

const EMPTY_PERMISSIONS: ReadonlySet<string> = new Set();
