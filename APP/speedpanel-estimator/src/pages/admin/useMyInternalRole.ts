// =============================================================================
// My internal staff role -- for client-side Admin section gating
// =============================================================================
// Plain table read (profiles.staff_role for auth.uid()), covered by the
// existing "Users can read own profile" RLS policy -- no new RPC needed.
// This is UI-side gating only (which tiles/routes render) -- the real
// security boundary is server-side (has_staff_role() in supabase/schema.sql,
// applied to the specific RPCs/policies listed in that migration's comment),
// so a stale or not-yet-loaded value here can never grant more than the
// server would actually allow.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { InternalRole } from "../company/staffTypes";

export function useMyInternalRole(userId: string | null): { staffRole: InternalRole | null; loading: boolean } {
  const [staffRole, setStaffRole] = useState<InternalRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("profiles").select("staff_role").eq("id", userId).single()
      .then((result: { data: { staff_role: string | null } | null }) => {
        if (cancelled) return;
        setStaffRole((result.data?.staff_role as InternalRole | null) ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { staffRole, loading };
}
