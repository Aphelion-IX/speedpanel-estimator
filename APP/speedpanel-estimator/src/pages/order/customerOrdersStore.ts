
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";
import { useAsyncResource } from "../projects/useAsyncResource";
import { OrderRowSchema } from "../projects/orders/orderTypes";
import {
  OrderOperationsRowSchema,
} from "../projects/orders/orderOperationsTypes";

const NOT_CONFIGURED =
  "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected orders data from the server.";

const CustomerOrderListRowSchema = OrderRowSchema.extend({
  projects: z.object({
    id: z.string(),
    name: z.string(),
    project_number: z.string().nullable(),
  }).nullable(),
  order_operations: OrderOperationsRowSchema.nullable(),
});

export type CustomerOrderListRow =
  z.infer<typeof CustomerOrderListRowSchema>;

export function useCustomerOrders(
  companyId: string | null,
) {
  const fetchOrders = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };

    let query = supabase
      .from("orders")
      .select(`
        *,
        projects(
          id,
          name,
          project_number
        ),
        order_operations(*)
      `)
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: error.message };

    const parsed =
      CustomerOrderListRowSchema.array().safeParse(
        data ?? [],
      );

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [companyId]);

  const state = useAsyncResource(fetchOrders, [companyId], {
    initialData: [] as CustomerOrderListRow[],
    skip: !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const metrics = useMemo(() => {
    const live = state.data.filter(
      order =>
        order.order_operations?.operational_status !==
          "cancelled" &&
        order.stage !== "cancelled",
    );

    return {
      total: live.length,
      actionRequired: live.filter(
        order =>
          order.order_operations?.customer_action_required,
      ).length,
      quotes: live.filter(
        order =>
          order.order_operations?.operational_status ===
          "quote_issued",
      ).length,
      fulfilment: live.filter(order =>
        [
          "accepted",
          "processing",
          "manufacturing",
          "ready_for_delivery",
          "partially_delivered",
        ].includes(
          order.order_operations?.operational_status ?? "",
        ),
      ).length,
    };
  }, [state.data]);

  return {
    orders: state.data,
    metrics,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}
