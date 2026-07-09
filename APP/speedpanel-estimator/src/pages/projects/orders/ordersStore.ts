// =============================================================================
// Orders -- list for a project + creation
// =============================================================================
// Same {data,loading,error,reload,...actions} shape as projectDetailStore.ts.
// Creation is a plain insert (no RPC) -- see supabase/schema.sql's "Owners
// can create their own orders" policy: order creation has no current-state
// transition to validate (no stage gating), so the RLS check-constraint
// alone (owner_id + project ownership) is sufficient.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import { OrderRowSchema, type OrderRow } from "./orderTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface OrdersState { orders: OrderRow[]; loading: boolean; error: string | null; }

export interface NewOrderTotals {
  lineItems: OrderLineItem[];
  subtotalExGst: number;
  gstRate: number;
  gstAmount: number;
  totalIncGst: number;
  unpricedItemCount: number;
}

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

  const createOrder = async (ownerId: string, totals: NewOrderTotals): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.from("orders").insert({
      project_id: projectId, owner_id: ownerId, line_items: totals.lineItems,
      subtotal_ex_gst: totals.subtotalExGst, gst_rate: totals.gstRate, gst_amount: totals.gstAmount,
      total_inc_gst: totals.totalIncGst, unpriced_item_count: totals.unpricedItemCount,
    }).select("*").single();
    if (error) return { id: null, error: error.message };
    const parsed = OrderRowSchema.safeParse(data);
    if (!parsed.success) return { id: null, error: BAD_SHAPE };
    setState(s => ({ ...s, orders: [parsed.data, ...s.orders] }));
    return { id: parsed.data.id, error: null };
  };

  return { ...state, reload: load, createOrder };
}
