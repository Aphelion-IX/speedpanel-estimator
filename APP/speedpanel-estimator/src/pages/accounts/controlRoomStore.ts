// =============================================================================
// Control Room -- KPI counts + price-list allocation, real data only
// =============================================================================
// companies/company_memberships/invitations/price_lists all already have an
// `or public.is_admin()` bypass on their own SELECT RLS policy (see
// supabase/schema.sql's "RLS: companies, company_memberships, invitations..."
// and "Pricing: Price Lists" sections) -- staff can read every row directly,
// no new RPC needed for Phase 1's real-data-only KPI tiles.
//
// Action-queue items that depend on data this phase doesn't build yet
// (price overrides expiring, price-list versions ready to publish) are
// deliberately NOT included here -- see ControlRoomPage.tsx's own comment.
// Only "invitations pending" and "companies on hold" (the latter using
// today's 3-value status enum, ahead of the full 5-value model Phase 2
// adds) are real enough to show now.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const NOT_CONFIGURED = "Company Accounts & Pricing isn't configured for this environment.";

export interface ControlRoomCounts {
  companies: number;
  externalUsers: number;
  pendingInvitations: number;
  activePriceLists: number;
  companiesOnHold: number;
}

export interface PriceListAllocationRow {
  id: string;
  name: string;
  isDefault: boolean;
  companyCount: number;
}

interface ControlRoomState {
  counts: ControlRoomCounts | null;
  allocation: PriceListAllocationRow[];
  loading: boolean;
  error: string | null;
}

const EMPTY: ControlRoomState = { counts: null, allocation: [], loading: true, error: null };

export function useControlRoom() {
  const [state, setState] = useState<ControlRoomState>(supabase ? EMPTY : { ...EMPTY, loading: false, error: NOT_CONFIGURED });

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    (async () => {
      const [companiesRes, membersRes, invitationsRes, priceListsRes, onHoldRes, allCompaniesRes] = await Promise.all([
        supabase!.from("companies").select("id", { count: "exact", head: true }),
        supabase!.from("company_memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase!.from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase!.from("price_lists").select("id", { count: "exact", head: true }),
        supabase!.from("companies").select("id", { count: "exact", head: true }).eq("status", "suspended"),
        supabase!.from("companies").select("price_list_id"),
      ]);
      if (cancelled) return;

      const firstError = companiesRes.error || membersRes.error || invitationsRes.error || priceListsRes.error || onHoldRes.error || allCompaniesRes.error;
      if (firstError) { setState({ counts: null, allocation: [], loading: false, error: firstError.message }); return; }

      const { data: priceLists, error: priceListsListError } = await supabase!.from("price_lists").select("id, name, is_default");
      if (cancelled) return;
      if (priceListsListError) { setState({ counts: null, allocation: [], loading: false, error: priceListsListError.message }); return; }

      const companyPriceListIds = (allCompaniesRes.data ?? []).map(c => c.price_list_id as string | null);
      const allocation: PriceListAllocationRow[] = (priceLists ?? []).map(pl => ({
        id: pl.id, name: pl.name, isDefault: pl.is_default,
        companyCount: companyPriceListIds.filter(id => id === pl.id).length,
      }));
      const unassignedCount = companyPriceListIds.filter(id => id === null).length;
      if (unassignedCount > 0) {
        allocation.push({ id: "__unassigned", name: "No assigned list", isDefault: false, companyCount: unassignedCount });
      }
      allocation.sort((a, b) => b.companyCount - a.companyCount);

      setState({
        counts: {
          companies: companiesRes.count ?? 0,
          externalUsers: membersRes.count ?? 0,
          pendingInvitations: invitationsRes.count ?? 0,
          activePriceLists: priceListsRes.count ?? 0,
          companiesOnHold: onHoldRes.count ?? 0,
        },
        allocation,
        loading: false,
        error: null,
      });
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}
