// =============================================================================
// Order Adjustments -- live Supabase fetch for one order
// =============================================================================
// A plain read hook, shared by both OrderDetailPage.tsx (customer, always
// read-only) and AdminOrderRow (Internal Sales, read + the write actions
// exposed separately by adminOrdersStore.ts's addAdjustment/
// removeAdjustment). order_adjustments' own RLS ("Owners, company, and
// admins can read order adjustments") covers both callers with one policy,
// no role branching needed here.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderAdjustmentRowSchema, type OrderAdjustmentRow } from "./orderAdjustmentTypes";

const NOT_CONFIGURED = "Adjustments aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface OrderAdjustmentsState { adjustments: OrderAdjustmentRow[]; loading: boolean; error: string | null; }

export function useOrderAdjustments(orderId: string | null) {
  const [state, setState] = useState<OrderAdjustmentsState>({ adjustments: [], loading: true, error: null });

  const load = useCallback(async () => {
    if (!supabase || !orderId) { setState({ adjustments: [], loading: false, error: supabase ? null : NOT_CONFIGURED }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("order_adjustments").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    if (error) { setState({ adjustments: [], loading: false, error: error.message }); return; }
    const parsed = OrderAdjustmentRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ adjustments: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ adjustments: parsed.data, loading: false, error: null });
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
