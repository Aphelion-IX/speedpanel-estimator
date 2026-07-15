// =============================================================================
// Admin order review queue -- live Supabase fetch
// =============================================================================
// Same shape as adminProjectsStore.ts's useAdminProjects: a narrow "awaiting
// action" queue -- stage in (submitted, proforma_requested), not every
// order. issue_proforma_invoice/cancel_order leave both stages (the order
// moves to proforma_issued/cancelled), so those actions remove the row
// locally; revise_order does neither -- the order stays in the queue at
// its current stage, just repriced, so it triggers a full reload instead
// of a local filter-out.
//
// 'submitted' orders were added to this queue's scope alongside
// revise_order -- previously this page only ever showed
// 'proforma_requested' orders, since issuing/cancelling were the only
// actions that existed; revising a quote before it's even reached the
// pro forma stage is equally valid, so the queue now surfaces both.
//
// Scoped to the caller's assigned companies via useMyQueueScope/
// applyQueueScope (see shared/useMyQueueScope.ts) -- a super_admin (or any
// account with no staff_role) still sees every order, unfiltered.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow } from "../../projects/orders/orderTypes";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import { useMyQueueScope, applyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface AdminOrdersState { orders: OrderRow[]; loading: boolean; error: string | null; }

export function useAdminOrders(userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean) {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [state, setState] = useState<AdminOrdersState>(() =>
    supabase
      ? { orders: [], loading: true, error: null }
      : { orders: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ orders: [], loading: false, error: scopeError }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await applyQueueScope(
      supabase.from("orders").select("*").in("stage", ["submitted", "proforma_requested"]), scope,
    ).order("created_at", { ascending: true });
    if (error) { setState({ orders: [], loading: false, error: error.message }); return; }
    const parsed = OrderRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ orders: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ orders: parsed.data, loading: false, error: null });
  }, [scopeLoading, scopeError, scope.kind === "companies" ? scope.companyIds.join(",") : "all"]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: string, args: Record<string, unknown>, id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    setState(s => ({ ...s, orders: s.orders.filter(o => o.id !== id) }));
    return null;
  };

  const issueProforma = (id: string, note: string) =>
    runAction("issue_proforma_invoice", { p_order_id: id, p_note: note || null }, id);
  const cancelOrder = (id: string) => runAction("cancel_order", { p_order_id: id }, id);

  // Doesn't move the order out of this queue's stage filter -- reload
  // instead of the filter-out runAction() does for issue/cancel, so the
  // row stays visible with its updated line items/totals.
  const reviseOrder = async (id: string, lineItems: OrderLineItem[], note: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("revise_order", { p_order_id: id, p_line_items: lineItems, p_note: note });
    if (error) return error.message;
    await load();
    return null;
  };

  return { ...state, reload: load, issueProforma, cancelOrder, reviseOrder };
}
