// =============================================================================
// Orders -- list for a project + creation
// =============================================================================
// Same {data,loading,error,reload,...actions} shape as projectDetailStore.ts.
// Creation goes through create_order() (Company Accounts & Pricing Phase
// 10) -- no longer a plain insert. The RPC re-resolves every line item's
// price server-side (ignoring whatever unitPriceExGst/lineTotalExGst the
// client sent) against the same override/assigned-list/PL1/catalog chain
// applyEffectivePricing.ts already uses for the pre-submission review UI,
// closing what was previously a real gap: order creation had no server-side
// price re-verification at all. See create_order()'s own comment in
// supabase/schema.sql for the full rationale.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import { OrderRowSchema, type OrderRow } from "./orderTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface OrdersState { orders: OrderRow[]; loading: boolean; error: string | null; }

export function useProjectOrders(projectId: string) {
  const [state, setState] = useState<OrdersState>(() =>
    supabase
      ? { orders: [], loading: true, error: null }
      : { orders: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("orders").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) { setState({ orders: [], loading: false, error: error.message }); return; }
    const parsed = OrderRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ orders: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ orders: parsed.data, loading: false, error: null });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // Only lineItems (category/qty/unit/label/productId -- what's being
  // ordered) and an optional customerNote are sent -- pricing totals are no
  // longer a client responsibility at all: create_order() recomputes
  // subtotal/gst/total server-side from its own re-resolved per-line
  // prices, so there's nothing left for the client to compute-and-send that
  // the server would trust anyway.
  const createOrder = async (lineItems: OrderLineItem[], customerNote?: string | null): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.rpc("create_order", {
      p_project_id: projectId, p_line_items: lineItems, p_customer_note: customerNote || null,
    });
    if (error) return { id: null, error: error.message };
    const parsed = OrderRowSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: BAD_SHAPE };
    setState(s => ({ ...s, orders: [parsed.data, ...s.orders] }));
    return { id: parsed.data.id, error: null };
  };

  return { ...state, reload: load, createOrder };
}
