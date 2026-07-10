// =============================================================================
// Admin manufacturing & delivery -- live Supabase fetch
// =============================================================================
// Unlike adminOrdersStore.ts's narrow "awaiting a decision" queue, this
// lists every confirmed order (stage = 'proforma_issued') -- there's no
// later order stage representing "fulfilled", so this tracking data IS the
// fulfillment record for as long as the order exists, not a transition to
// filter out of view on success (see supabase/schema.sql's manufacturing &
// delivery tracking comment). Both updateManufacturing/updateDeliveryStatus
// are plain .update() calls, no RPC -- the existing "Owners and admins can
// update orders"/"...admins anytime" RLS policies already permit this,
// unused by any UI until now.
//
// project_name comes via supabase-js's embedded-resource select
// (orders.project_id -> projects.id is a real FK, so PostgREST can join it
// directly) rather than a second query -- same one-request join Supabase
// already supports for every other admin list in this app that needs a
// related table's field.
//
// Deliveries for all listed orders are fetched in one batched
// .in("order_id", ids) query and grouped client-side, avoiding an N+1 query
// per order (see orders/orderDeliveriesStore.ts for the per-order version
// this mirrors).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, OrderDeliveryRowSchema, type OrderRow, type OrderDeliveryRow, type DeliveryStatus } from "../../projects/orders/orderTypes";

const NOT_CONFIGURED = "Manufacturing & delivery aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const AdminManufacturingOrderRowSchema = OrderRowSchema.extend({
  projects: z.object({ name: z.string() }).nullable(),
});

export interface AdminManufacturingOrder {
  order: OrderRow;
  projectName: string;
  deliveries: OrderDeliveryRow[];
}

interface ManufacturingState { rows: AdminManufacturingOrder[]; loading: boolean; error: string | null; }

export function useAdminManufacturing() {
  const [state, setState] = useState<ManufacturingState>(() =>
    supabase
      ? { rows: [], loading: true, error: null }
      : { rows: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data: orderData, error: orderError } = await supabase.from("orders")
      .select("*, projects(name)").eq("stage", "proforma_issued").order("proforma_issued_at", { ascending: false });
    if (orderError) { setState({ rows: [], loading: false, error: orderError.message }); return; }
    const parsedOrders = AdminManufacturingOrderRowSchema.array().safeParse(orderData ?? []);
    if (!parsedOrders.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }

    const orderIds = parsedOrders.data.map(o => o.id);
    const { data: deliveryData, error: deliveryError } = orderIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("order_deliveries").select("*").in("order_id", orderIds).order("sequence_no", { ascending: true });
    if (deliveryError) { setState({ rows: [], loading: false, error: deliveryError.message }); return; }
    const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
    if (!parsedDeliveries.success) { setState({ rows: [], loading: false, error: BAD_SHAPE }); return; }

    const rows: AdminManufacturingOrder[] = parsedOrders.data.map(({ projects, ...order }) => ({
      order,
      projectName: projects?.name ?? "(project deleted)",
      deliveries: parsedDeliveries.data.filter(d => d.order_id === order.id),
    }));
    setState({ rows, loading: false, error: null });
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateManufacturing = async (
    orderId: string, patch: { panels_manufactured: number | null; manufacturing_est_completion: string | null },
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) return error.message;
    setState(s => ({
      ...s,
      rows: s.rows.map(r => r.order.id === orderId ? { ...r, order: { ...r.order, ...patch } } : r),
    }));
    return null;
  };

  const updateDeliveryStatus = async (deliveryId: string, status: DeliveryStatus): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("order_deliveries").update({ status }).eq("id", deliveryId);
    if (error) return error.message;
    setState(s => ({
      ...s,
      rows: s.rows.map(r => ({ ...r, deliveries: r.deliveries.map(d => d.id === deliveryId ? { ...d, status } : d) })),
    }));
    return null;
  };

  return { ...state, reload: load, updateManufacturing, updateDeliveryStatus };
}
