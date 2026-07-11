// =============================================================================
// useCompanyMemberships -- which company workspace(s) is the signed-in user in
// =============================================================================
// A plain read of company_memberships (its own "Members can read their own
// membership rows" RLS policy already covers "where user_id = auth.uid()"),
// embedding the company name via the company_id -> companies FK -- no RPC
// needed just to answer "which companies am I in". 0 rows = fully solo,
// unchanged from before company workspaces existed. 1 row = auto-selected as
// the active company, no picker needed. >1 row = a header company-switcher
// (see AuthStatus.tsx's neighbourhood) lets the user pick; this hook just
// remembers whichever one is active, in local state only -- reopening the
// app re-defaults to the first membership, not persisted across sessions.
//
// Also fires touch_last_active() once per sign-in -- the only writer of
// company_memberships.last_active_at (see supabase/schema.sql), which would
// otherwise just be a dead column.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import type { UseAuth } from "./useAuth";
import { MyCompanyMembershipRowSchema, type MyCompanyMembership } from "../pages/company/companyTypes";

interface CompanyMembershipsState { memberships: MyCompanyMembership[]; loading: boolean; error: string | null; }

export function useCompanyMemberships(auth: UseAuth) {
  const [state, setState] = useState<CompanyMembershipsState>({ memberships: [], loading: false, error: null });
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const userId = auth.user?.id ?? null;

  const load = useCallback(async () => {
    if (!supabase || !userId) { setState({ memberships: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("company_memberships")
      .select("company_id, role, status, companies(legal_name, trading_name)")
      .eq("user_id", userId).eq("status", "active");
    if (error) { setState({ memberships: [], loading: false, error: error.message }); return; }
    const parsed = MyCompanyMembershipRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ memberships: [], loading: false, error: "Unexpected data shape from the server." }); return; }
    setState({ memberships: parsed.data, loading: false, error: null });
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Auto-select the only membership; default to the first when there are
  // several and the previously-active one is no longer in the list (e.g.
  // just removed).
  useEffect(() => {
    setActiveCompanyId(current => {
      if (state.memberships.length === 0) return null;
      if (current && state.memberships.some(m => m.company_id === current)) return current;
      return state.memberships[0].company_id;
    });
  }, [state.memberships]);

  useEffect(() => {
    if (!supabase || !userId) return;
    supabase.rpc("touch_last_active");
  }, [userId]);

  const activeMembership = state.memberships.find(m => m.company_id === activeCompanyId) ?? null;

  return { ...state, activeCompanyId, setActiveCompanyId, activeMembership, reload: load };
}

export type UseCompanyMemberships = ReturnType<typeof useCompanyMemberships>;
