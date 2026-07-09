// =============================================================================
// Single Order -- detail view state + stage actions
// =============================================================================
// Same shape as projectDetailStore.ts's useProject(id): live single-row
// state plus the stage-transition RPC calls. submit_order/
// request_proforma_invoice/cancel_order mirror
// request_install_review/request_technical_review's plain
// supabase.rpc(fn, args) + reload pattern exactly.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow } from "./orderTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "This order's data looks corrupted and can't be opened.";

interface OrderState { order: OrderRow | null; loading: boolean; error: string | null; }

export function useOrder(orderId: string) {
  const [state, setState] = useState<OrderState>(() =>
    supabase
      ? { order: null, loading: true, error: null }
      : { order: null, loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (error) { setState({ order: null, loading: false, error: error.message }); return; }
    const parsed = OrderRowSchema.safeParse(data);
    if (!parsed.success) { setState({ order: null, loading: false, error: BAD_SHAPE }); return; }
    setState({ order: parsed.data, loading: false, error: null });
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const callRpc = async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await load();
    return null;
  };

  const submitOrder = () => callRpc("submit_order", { p_order_id: orderId });
  const requestProformaInvoice = () => callRpc("request_proforma_invoice", { p_order_id: orderId });
  const cancelOrder = () => callRpc("cancel_order", { p_order_id: orderId });

  return { ...state, reload: load, submitOrder, requestProformaInvoice, cancelOrder };
}
