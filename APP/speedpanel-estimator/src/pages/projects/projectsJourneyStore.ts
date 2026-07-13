// =============================================================================
// Per-project journey-stage aggregation -- feeds ProjectsListPage.tsx's
// table/cards and stage-count tabs
// =============================================================================
// The one genuinely new data plumbing this redesign needs: today's project
// list has no per-project order/manufacturing/delivery data at all. Fetches
// every order visible to the caller (trusting RLS, same convention as
// dashboardStore.ts's useOrdersSummary -- no client-side owner_id/company
// filter) plus every relevant order_deliveries row batched via `.in(...)`,
// groups both by project_id, and runs journeyStage.ts's audited
// journeyStageForProject() once per project. `projects` is the caller's own
// already-loaded ProjectRow list (from projectsStore.ts's useProjects) --
// this hook doesn't fetch projects itself, only the order/delivery data a
// journey computation needs on top of them.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow, OrderDeliveryRowSchema, type OrderDeliveryRow } from "./orders/orderTypes";
import { DELIVERY_COLUMNS } from "./orders/orderDeliveriesStore";
import { journeyStageForProject, journeyProgressPercent, type JourneyResult, type JourneyProjectInput } from "./journeyStage";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export interface ProjectJourneyInfo {
  journey: JourneyResult;
  progress: number;
  representativeOrder: OrderRow | undefined;
  representativeDeliveries: OrderDeliveryRow[];
}

interface JourneyState {
  byProject: Map<string, ProjectJourneyInfo>;
  loading: boolean;
  error: string | null;
}

export type JourneyProjectRow = JourneyProjectInput & { id: string };

export function useProjectsJourney(user: User | null, projects: JourneyProjectRow[]) {
  const [state, setState] = useState<JourneyState>(() =>
    !supabase || !user ? { byProject: new Map(), loading: false, error: !supabase ? NOT_CONFIGURED : null }
    : { byProject: new Map(), loading: projects.length > 0, error: null },
  );

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    if (projects.length === 0) { setState({ byProject: new Map(), loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));

    const { data: orderData, error: orderError } = await supabase.from("orders").select("*").neq("stage", "cancelled");
    if (orderError) { setState({ byProject: new Map(), loading: false, error: orderError.message }); return; }
    const parsedOrders = OrderRowSchema.array().safeParse(orderData ?? []);
    if (!parsedOrders.success) { setState({ byProject: new Map(), loading: false, error: BAD_SHAPE }); return; }

    const projectIds = new Set(projects.map(p => p.id));
    const orders = parsedOrders.data.filter(o => projectIds.has(o.project_id));
    const orderIds = orders.map(o => o.id);

    const { data: deliveryData, error: deliveryError } = orderIds.length === 0
      ? { data: [] as unknown[], error: null }
      : await supabase.from("order_deliveries").select(DELIVERY_COLUMNS).in("order_id", orderIds);
    if (deliveryError) { setState({ byProject: new Map(), loading: false, error: deliveryError.message }); return; }
    const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
    if (!parsedDeliveries.success) { setState({ byProject: new Map(), loading: false, error: BAD_SHAPE }); return; }

    const deliveriesByOrder = new Map<string, OrderDeliveryRow[]>();
    for (const d of parsedDeliveries.data) deliveriesByOrder.set(d.order_id, [...(deliveriesByOrder.get(d.order_id) ?? []), d]);

    const ordersByProject = new Map<string, OrderRow[]>();
    for (const o of orders) ordersByProject.set(o.project_id, [...(ordersByProject.get(o.project_id) ?? []), o]);

    const byProject = new Map<string, ProjectJourneyInfo>();
    for (const project of projects) {
      const projectOrders = ordersByProject.get(project.id) ?? [];
      const journey = journeyStageForProject(project, projectOrders.map(order => ({ order, deliveries: deliveriesByOrder.get(order.id) ?? [] })));
      const representativeOrder = projectOrders.find(o => o.id === journey.representativeOrderId);
      byProject.set(project.id, {
        journey,
        progress: journeyProgressPercent(journey.stage, representativeOrder),
        representativeOrder,
        representativeDeliveries: representativeOrder ? (deliveriesByOrder.get(representativeOrder.id) ?? []) : [],
      });
    }
    setState({ byProject, loading: false, error: null });
  }, [user, projects.map(p => p.id).join(",")]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
