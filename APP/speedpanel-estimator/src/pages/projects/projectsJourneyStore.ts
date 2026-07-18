// =============================================================================
// Per-project journey-stage aggregation -- feeds ProjectsListPage.tsx's
// table/cards and stage-count tabs
// =============================================================================
// Fetches every order visible to the caller (trusting RLS, same convention
// as dashboardStore.ts's useOrdersSummary -- no client-side owner_id/company
// filter) plus every relevant order_deliveries row batched via `.in(...)`,
// groups both by project_id, and runs journeyStage.ts's audited
// journeyStageForProject() once per project. `projects` is the caller's own
// already-loaded ProjectRow list (from projectsStore.ts's useProjects) --
// this hook doesn't fetch projects itself, only the order/delivery data a
// journey computation needs on top of them.
//
// Only refetches when the set of project ids actually changes (via
// useStableIds), not merely because the caller's `projects` array was
// reallocated this render -- same intentional "batch this by id" behavior
// as before, just expressed as a real dependency instead of a `.join(",")`
// string.
// =============================================================================
import { useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow, OrderDeliveryRowSchema, type OrderDeliveryRow } from "./orders/orderTypes";
import { DELIVERY_COLUMNS } from "./orders/orderDeliveriesStore";
import { journeyStageForProject, journeyProgressPercent, type JourneyResult, type JourneyProjectInput } from "./journeyStage";
import { useAsyncResource, useStableIds } from "./useAsyncResource";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export interface ProjectJourneyInfo {
  journey: JourneyResult;
  progress: number;
  representativeOrder: OrderRow | undefined;
  representativeDeliveries: OrderDeliveryRow[];
}

export type JourneyProjectRow = JourneyProjectInput & { id: string };

export function useProjectsJourney(user: User | null, projects: JourneyProjectRow[]) {
  const ids = useMemo(() => projects.map(p => p.id), [projects]);
  const stableIds = useStableIds(ids);

  const fetchJourneys = useCallback(async (): Promise<{ data: Map<string, ProjectJourneyInfo>; error: string | null }> => {
    if (!supabase || !user || stableIds.length === 0) return { data: new Map(), error: null };

    const { data: orderData, error: orderError } = await supabase.from("orders").select("*").neq("stage", "cancelled");
    if (orderError) return { data: new Map(), error: orderError.message };
    const parsedOrders = OrderRowSchema.array().safeParse(orderData ?? []);
    if (!parsedOrders.success) return { data: new Map(), error: BAD_SHAPE };

    const projectIds = new Set(stableIds);
    const orders = parsedOrders.data.filter(o => projectIds.has(o.project_id));
    const orderIds = orders.map(o => o.id);

    const { data: deliveryData, error: deliveryError } = orderIds.length === 0
      ? { data: [] as unknown[], error: null }
      : await supabase.from("order_deliveries").select(DELIVERY_COLUMNS).in("order_id", orderIds);
    if (deliveryError) return { data: new Map(), error: deliveryError.message };
    const parsedDeliveries = OrderDeliveryRowSchema.array().safeParse(deliveryData ?? []);
    if (!parsedDeliveries.success) return { data: new Map(), error: BAD_SHAPE };

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
    return { data: byProject, error: null };
    // `projects` (unlike `stableIds`) is intentionally not a dependency here:
    // this only needs to refetch when the *set* of project ids changes, not
    // when e.g. a project's stage is patched in place -- callers that need a
    // fresh read after such a change already call reload() explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, stableIds]);

  const { data: byProject, loading, error, reload } = useAsyncResource(fetchJourneys, [user, stableIds], {
    initialData: new Map<string, ProjectJourneyInfo>(),
    skip: !supabase || !user || stableIds.length === 0,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return { byProject, loading, error, reload };
}
