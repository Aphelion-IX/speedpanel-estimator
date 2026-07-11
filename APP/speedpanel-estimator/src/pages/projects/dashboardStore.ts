// =============================================================================
// Projects dashboard -- orders pipeline summary
// =============================================================================
// Feeds the "Orders" stat row on ProjectsListPage.tsx's dashboard. No
// client-side owner_id filter -- trusts RLS (company/project-membership-
// aware, see schema.sql's can_view_project()) to return exactly the caller's
// own orders plus any shared through a company, the same "server is the
// real gate" convention this store's sibling stores already use.
//
// Narrower Zod schema than orderTypes.ts's full OrderRowSchema, matching
// admin/products/productMappers.ts's convention of a schema shaped to what's
// actually selected -- this only ever reads stage + total_inc_gst, not a full
// order row.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";
import { ORDER_STAGES, type OrderStage } from "./orders/orderTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const OrderSummaryRowSchema = z.object({ stage: z.enum(ORDER_STAGES), total_inc_gst: z.number() });

interface OrdersSummaryState {
  ordersByStage: Record<OrderStage, number>;
  ordersTotal: number;
  totalValue: number;
  loading: boolean;
  error: string | null;
}

const emptyByStage = (): Record<OrderStage, number> =>
  Object.fromEntries(ORDER_STAGES.map(s => [s, 0])) as Record<OrderStage, number>;

export function useOrdersSummary(user: User | null) {
  const [state, setState] = useState<OrdersSummaryState>(() =>
    !supabase || !user
      ? { ordersByStage: emptyByStage(), ordersTotal: 0, totalValue: 0, loading: false, error: !supabase ? NOT_CONFIGURED : null }
      : { ordersByStage: emptyByStage(), ordersTotal: 0, totalValue: 0, loading: true, error: null },
  );

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("orders").select("stage, total_inc_gst");
    if (error) { setState({ ordersByStage: emptyByStage(), ordersTotal: 0, totalValue: 0, loading: false, error: error.message }); return; }
    const parsed = OrderSummaryRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ ordersByStage: emptyByStage(), ordersTotal: 0, totalValue: 0, loading: false, error: BAD_SHAPE }); return; }
    const ordersByStage = emptyByStage();
    let totalValue = 0;
    for (const row of parsed.data) {
      ordersByStage[row.stage] += 1;
      if (row.stage !== "cancelled") totalValue += row.total_inc_gst;
    }
    setState({ ordersByStage, ordersTotal: parsed.data.length, totalValue, loading: false, error: null });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
