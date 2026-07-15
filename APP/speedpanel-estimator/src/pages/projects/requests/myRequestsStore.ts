// =============================================================================
// My Requests -- consolidated request history across ALL of a customer's
// projects
// =============================================================================
// Unlike NextActionsCallout (OverviewDashboardPage.tsx), which only surfaces
// items needing action right now, this is a full history view -- every
// install/technical review request, delivery request, and contact/quote
// request, whatever its current status. Composes existing data/queries
// rather than re-fetching from scratch:
//  - Review requests: derived directly from the caller's already-loaded
//    `projects` (from projectsStore.ts's useProjects) -- no query.
//  - Delivery requests: same "fetch all orders trusting RLS, then one
//    batched order_deliveries .in(...) call" pattern as
//    projectsJourneyStore.ts, filtered to this customer's own project IDs.
//    Uses the exported DELIVERY_COLUMNS constant, never a bare select("*")
//    -- order_deliveries.internal_note's column-level REVOKE makes a bare
//    select("*") hard-error for every non-staff caller.
//  - Contact/quote requests: a new query against `requests`, gated by the
//    "Owners, company, and admins can read their own requests" RLS policy
//    (see supabase/schema.sql) -- until that policy is applied to the live
//    project, Postgres RLS with no matching policy just returns zero rows
//    successfully (not an error), so this section degrades to an empty
//    state automatically, no special-case handling needed here.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabaseClient";
import type { ProjectRow, ReviewStatus } from "../projectTypes";
import { OrderRowSchema, type OrderRow, OrderDeliveryRowSchema, type OrderDeliveryRow } from "../orders/orderTypes";
import { DELIVERY_COLUMNS } from "../orders/orderDeliveriesStore";
import { AdminRequestRowSchema, type AdminRequestRow } from "./requestTypes";

const NOT_CONFIGURED = "Requests aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export type MyRequestItem =
  | { source: "review"; kind: "install" | "technical"; project: ProjectRow; status: ReviewStatus; at: string }
  | { source: "delivery"; delivery: OrderDeliveryRow; order: OrderRow; project: ProjectRow; at: string }
  | { source: "contact"; request: AdminRequestRow; project: ProjectRow | null; at: string };

interface MyRequestsState { items: MyRequestItem[]; loading: boolean; error: string | null; }

export function useMyRequests(user: User | null, projects: ProjectRow[]) {
  const [state, setState] = useState<MyRequestsState>(() =>
    !supabase || !user ? { items: [], loading: false, error: !supabase ? NOT_CONFIGURED : null }
    : { items: [], loading: projects.length > 0, error: null },
  );

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    if (projects.length === 0) { setState({ items: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));

    const projectsById = new Map(projects.map(p => [p.id, p]));
    const projectIds = projects.map(p => p.id);

    const reviewItems: MyRequestItem[] = [];
    for (const p of projects) {
      if (p.install_review_status) reviewItems.push({ source: "review", kind: "install", project: p, status: p.install_review_status, at: p.updated_at });
      if (p.technical_review_status) reviewItems.push({ source: "review", kind: "technical", project: p, status: p.technical_review_status, at: p.updated_at });
    }

    const { data: orderData, error: orderError } = await supabase.from("orders").select("*").neq("stage", "cancelled");
    if (orderError) { setState({ items: [], loading: false, error: orderError.message }); return; }
    const parsedOrders = OrderRowSchema.array().safeParse(orderData ?? []);
    if (!parsedOrders.success) { setState({ items: [], loading: false, error: BAD_SHAPE }); return; }
    const orders = parsedOrders.data.filter(o => projectsById.has(o.project_id));
    const ordersById = new Map(orders.map(o => [o.id, o]));
    const orderIds = orders.map(o => o.id);

    const { data: deliveryData, error: deliveryError } = orderIds.length === 0
      ? { data: [] as unknown[], error: null }
      : await supabase.from("order_deliveries").select(DELIVERY_COLUMNS).in("order_id", orderIds);
    if (deliveryError) { setState({ items: [], loading: false, error: deliveryError.message }); return; }
    const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
    if (!parsedDeliveries.success) { setState({ items: [], loading: false, error: BAD_SHAPE }); return; }
    // approval_status='draft' rows are staff-internal splits, never
    // customer-visible -- same convention as OrderDetailPage.tsx's
    // visibleDeliveries filter.
    const deliveryItems: MyRequestItem[] = parsedDeliveries.data
      .filter(d => d.approval_status !== "draft")
      .map(d => {
        const order = ordersById.get(d.order_id)!;
        return { source: "delivery", delivery: d, order, project: projectsById.get(order.project_id)!, at: d.created_at };
      });

    const { data: requestData, error: requestError } = await supabase.from("requests")
      .select("id, created_at, name, email, phone, message, project_snapshot, project_id, status")
      .in("project_id", projectIds);
    if (requestError) { setState({ items: [], loading: false, error: requestError.message }); return; }
    const parsedRequests = AdminRequestRowSchema.array().safeParse(requestData ?? []);
    if (!parsedRequests.success) { setState({ items: [], loading: false, error: BAD_SHAPE }); return; }
    const contactItems: MyRequestItem[] = parsedRequests.data.map(r => ({
      source: "contact", request: r, project: r.project_id ? (projectsById.get(r.project_id) ?? null) : null, at: r.created_at,
    }));

    const items = [...reviewItems, ...deliveryItems, ...contactItems].sort((a, b) => b.at.localeCompare(a.at));
    setState({ items, loading: false, error: null });
  }, [user, projects.map(p => p.id).join(",")]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
