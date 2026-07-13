// =============================================================================
// Admin order review queue -- live Supabase fetch
// =============================================================================
// Same shape as adminProjectsStore.ts's useAdminProjects: a narrow "awaiting
// action" queue (stage = 'proforma_requested', not every order), and a
// successful action removes the row locally since it leaves that filter --
// same "narrower than submitted, matches the two-step decision" reasoning
// documented in supabase/schema.sql.
//
// Scoped to the caller's assigned companies via useMyQueueScope/
// applyQueueScope (see shared/useMyQueueScope.ts) -- a super_admin (or any
// account with no staff_role) still sees every order, unfiltered.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow } from "../../projects/orders/orderTypes";
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
      supabase.from("orders").select("*").eq("stage", "proforma_requested"), scope,
    ).order("proforma_requested_at", { ascending: true });
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

  // Distinct from runAction above: an adjustment/line-price edit does NOT
  // move the order out of the proforma_requested queue, so it must not be
  // filtered out of local state -- it needs a re-fetch instead, to pick up
  // the RPC's server-side recompute_order_totals() result. Refetches only
  // THIS ONE order's row (not the whole queue via load()) -- load() sets
  // loading: true, which unmounts every AdminOrderRow while it's true
  // (AdminOrdersPage's `if (loading) return <Loading/>`), resetting every
  // row's local UI state (open accordions, in-progress forms) on every
  // single adjustment. Found by browser-testing this exact flow.
  const runAdjustmentAction = async (fn: string, args: Record<string, unknown>, orderId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    const { data, error: fetchErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (fetchErr) return fetchErr.message;
    const parsed = OrderRowSchema.safeParse(data);
    if (!parsed.success) return BAD_SHAPE;
    setState(s => ({ ...s, orders: s.orders.map(o => o.id === orderId ? parsed.data : o) }));
    return null;
  };

  const addAdjustment = (
    orderId: string, kind: string, label: string, amountExGst: number | null, savedFeeId: string | null,
  ) => runAdjustmentAction("add_order_adjustment", {
    p_order_id: orderId, p_kind: kind, p_label: label, p_amount_ex_gst: amountExGst, p_saved_fee_id: savedFeeId,
  }, orderId);
  const removeAdjustment = (orderId: string, adjustmentId: string) =>
    runAdjustmentAction("remove_order_adjustment", { p_order_id: orderId, p_adjustment_id: adjustmentId }, orderId);
  const setLinePrice = (orderId: string, lineItemId: string, unitPriceExGst: number) =>
    runAdjustmentAction("admin_set_order_line_price", { p_order_id: orderId, p_line_item_id: lineItemId, p_unit_price_ex_gst: unitPriceExGst }, orderId);

  return { ...state, reload: load, issueProforma, cancelOrder, addAdjustment, removeAdjustment, setLinePrice };
}
