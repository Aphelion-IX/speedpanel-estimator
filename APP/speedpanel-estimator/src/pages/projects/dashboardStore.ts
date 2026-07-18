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
import { useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";
import { ORDER_STAGES, type OrderStage } from "./orders/orderTypes";
import { useAsyncResource } from "./useAsyncResource";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const OrderSummaryRowSchema = z.object({ stage: z.enum(ORDER_STAGES), total_inc_gst: z.number() });

interface OrdersSummaryData {
  ordersByStage: Record<OrderStage, number>;
  ordersTotal: number;
  totalValue: number;
}

const emptyByStage = (): Record<OrderStage, number> =>
  Object.fromEntries(ORDER_STAGES.map(s => [s, 0])) as Record<OrderStage, number>;

const emptySummary = (): OrdersSummaryData => ({ ordersByStage: emptyByStage(), ordersTotal: 0, totalValue: 0 });

export function useOrdersSummary(user: User | null) {
  const fetchSummary = useCallback(async (): Promise<{ data: OrdersSummaryData; error: string | null }> => {
    if (!supabase || !user) return { data: emptySummary(), error: null };
    const { data, error } = await supabase.from("orders").select("stage, total_inc_gst");
    if (error) return { data: emptySummary(), error: error.message };
    const parsed = OrderSummaryRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) return { data: emptySummary(), error: BAD_SHAPE };
    const ordersByStage = emptyByStage();
    let totalValue = 0;
    for (const row of parsed.data) {
      ordersByStage[row.stage] += 1;
      if (row.stage !== "cancelled") totalValue += row.total_inc_gst;
    }
    return { data: { ordersByStage, ordersTotal: parsed.data.length, totalValue }, error: null };
  }, [user]);

  const { data, loading, error, reload } = useAsyncResource(fetchSummary, [user], {
    initialData: emptySummary(),
    skip: !supabase || !user,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return { ...data, loading, error, reload };
}
