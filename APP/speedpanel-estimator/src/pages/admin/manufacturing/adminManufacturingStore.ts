// =============================================================================
// Admin manufacturing & delivery -- live Supabase fetch
// =============================================================================
// Unlike adminOrdersStore.ts's narrow "awaiting a decision" queue, this
// lists every confirmed order (stage = 'proforma_issued') -- there's no
// later order stage representing "fulfilled", so this tracking data IS the
// fulfillment record for as long as the order exists, not a transition to
// filter out of view on success (see supabase/schema.sql's manufacturing &
// delivery tracking comment). updateManufacturing/updateDeliveryStatus go
// through admin_update_manufacturing/admin_update_delivery_status (both
// has_staff_role(array['dispatch'])-gated) rather than a plain .update() --
// the shared "Owners, company, and admins can update orders" RLS policy
// admins used to rely on for this is also the customer's own order-edit
// path via can_edit_project, so it can't be narrowed to Dispatch alone; two
// small dedicated RPCs keep this specific write scoped correctly instead.
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
// this mirrors) -- scoped per page as pages load, same as the orders query.
//
// Paginated (PAGE_SIZE per page, via .range()) -- unlike AdminOrdersPage's
// narrow "awaiting a decision" queue, this data IS the permanent fulfillment
// record for every confirmed order for as long as it exists, so it only
// ever grows.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, OrderDeliveryRowSchema, type OrderRow, type OrderDeliveryRow, type DeliveryStatus } from "../../projects/orders/orderTypes";

const NOT_CONFIGURED = "Manufacturing & delivery aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PAGE_SIZE = 50;

const AdminManufacturingOrderRowSchema = OrderRowSchema.extend({
  projects: z.object({ name: z.string() }).nullable(),
});

export interface AdminManufacturingOrder {
  order: OrderRow;
  projectName: string;
  deliveries: OrderDeliveryRow[];
}

interface ManufacturingState { rows: AdminManufacturingOrder[]; loading: boolean; loadingMore: boolean; error: string | null; hasMore: boolean; }

async function fetchPage(from: number, to: number): Promise<{ rows: AdminManufacturingOrder[] } | { error: string }> {
  const { data: orderData, error: orderError } = await supabase!.from("orders")
    .select("*, projects(name)").eq("stage", "proforma_issued").order("proforma_issued_at", { ascending: false }).range(from, to);
  if (orderError) return { error: orderError.message };
  const parsedOrders = AdminManufacturingOrderRowSchema.array().safeParse(orderData ?? []);
  if (!parsedOrders.success) return { error: BAD_SHAPE };

  const orderIds = parsedOrders.data.map(o => o.id);
  const { data: deliveryData, error: deliveryError } = orderIds.length === 0
    ? { data: [], error: null }
    : await supabase!.from("order_deliveries").select("*").in("order_id", orderIds).order("sequence_no", { ascending: true });
  if (deliveryError) return { error: deliveryError.message };
  const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
  if (!parsedDeliveries.success) return { error: BAD_SHAPE };

  return {
    rows: parsedOrders.data.map(({ projects, ...order }) => ({
      order,
      projectName: projects?.name ?? "(project deleted)",
      deliveries: parsedDeliveries.data.filter(d => d.order_id === order.id),
    })),
  };
}

export function useAdminManufacturing() {
  const [state, setState] = useState<ManufacturingState>(() =>
    supabase
      ? { rows: [], loading: true, loadingMore: false, error: null, hasMore: false }
      : { rows: [], loading: false, loadingMore: false, error: NOT_CONFIGURED, hasMore: false },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const result = await fetchPage(0, PAGE_SIZE - 1);
    if ("error" in result) { setState({ rows: [], loading: false, loadingMore: false, error: result.error, hasMore: false }); return; }
    setState({ rows: result.rows, loading: false, loadingMore: false, error: null, hasMore: result.rows.length === PAGE_SIZE });
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loadingMore: true }));
    const from = state.rows.length;
    const result = await fetchPage(from, from + PAGE_SIZE - 1);
    if ("error" in result) { setState(s => ({ ...s, loadingMore: false, error: result.error })); return; }
    setState(s => ({ ...s, rows: [...s.rows, ...result.rows], loadingMore: false, hasMore: result.rows.length === PAGE_SIZE }));
  };

  const updateManufacturing = async (
    orderId: string, patch: { panels_manufactured: number | null; manufacturing_est_completion: string | null },
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_update_manufacturing", {
      p_order_id: orderId, p_panels_manufactured: patch.panels_manufactured, p_manufacturing_est_completion: patch.manufacturing_est_completion,
    });
    if (error) return error.message;
    setState(s => ({
      ...s,
      rows: s.rows.map(r => r.order.id === orderId ? { ...r, order: { ...r.order, ...patch } } : r),
    }));
    return null;
  };

  const updateDeliveryStatus = async (deliveryId: string, status: DeliveryStatus): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("admin_update_delivery_status", { p_delivery_id: deliveryId, p_status: status });
    if (error) return error.message;
    setState(s => ({
      ...s,
      rows: s.rows.map(r => ({ ...r, deliveries: r.deliveries.map(d => d.id === deliveryId ? { ...d, status } : d) })),
    }));
    return null;
  };

  return { ...state, reload: load, loadMore, updateManufacturing, updateDeliveryStatus };
}
