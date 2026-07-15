// =============================================================================
// Live "awaiting action" counts for AdminDashboard.tsx's Workflow tiles
// =============================================================================
// One count per tile, badge-style, so a staff member can see what needs
// attention without opening each queue page. Every query here mirrors the
// exact predicate its own queue page already uses (adminProjectsStore.ts,
// adminOrdersStore.ts, requestsStore.ts, adminDeliveryRequestsStore.ts) --
// just `{count:"exact", head:true}` (or a client-side filter/count for the
// one RPC-backed queue) instead of fetching full rows, same posture as
// analyticsStore.ts's existing count-only queries. All five share one
// useMyQueueScope resolution since they all scope off the same staff
// member's company assignments.
//
// Manufacturing & Delivery has no queue page of its own with a matching
// predicate -- it's a permanent fulfillment record, not a decision queue
// (see adminManufacturingStore.ts's header comment) -- so its count is a
// deliberate product choice: deliveries still `status = 'planned'` among
// this staff member's proforma-issued orders.
//
// `null` per-field = not yet resolved, distinct from `0`, so a tile shows
// no badge until its count is known rather than a "0" that then pops to a
// real number.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useMyQueueScope, applyQueueScope } from "./shared/useMyQueueScope";
import { DELIVERY_AWAITING_DECISION_STATUSES } from "../projects/orders/orderTypes";
import type { InternalRole } from "../company/staffTypes";

interface WorkflowCounts {
  requests: number | null;
  projectReviews: number | null;
  orders: number | null;
  deliveryRequests: number | null;
  manufacturing: number | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: WorkflowCounts = {
  requests: null, projectReviews: null, orders: null, deliveryRequests: null, manufacturing: null,
  loading: true, error: null,
};

export function useWorkflowCounts(
  userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean,
): WorkflowCounts {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [state, setState] = useState<WorkflowCounts>(() => (supabase ? EMPTY : { ...EMPTY, loading: false }));
  const companyKey = scope.kind === "companies" ? scope.companyIds.join(",") : "all";

  useEffect(() => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ ...EMPTY, loading: false, error: scopeError }); return; }
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));

    (async () => {
      const projectReviewsQ = applyQueueScope(
        supabase!.from("projects").select("id", { count: "exact", head: true }).in("stage", ["install_review", "technical_review"]), scope,
      );
      const ordersQ = applyQueueScope(
        supabase!.from("orders").select("id", { count: "exact", head: true }).in("stage", ["submitted", "proforma_requested"]), scope,
      );

      const requestsCount = async (): Promise<{ count: number | null; error: string | null }> => {
        if (scope.kind === "companies") {
          const { data, error } = await supabase!.from("projects").select("id").in("company_id", scope.companyIds);
          if (error) return { count: null, error: error.message };
          const projectIds = (data ?? []).map(r => (r as { id: string }).id);
          if (projectIds.length === 0) return { count: 0, error: null };
          const { count, error: countError } = await supabase!.from("requests")
            .select("id", { count: "exact", head: true }).eq("status", "new").in("project_id", projectIds);
          return { count: count ?? 0, error: countError ? countError.message : null };
        }
        const { count, error } = await supabase!.from("requests").select("id", { count: "exact", head: true }).eq("status", "new");
        return { count: count ?? 0, error: error ? error.message : null };
      };

      const deliveryRequestsCount = async (): Promise<{ count: number | null; error: string | null }> => {
        const { data, error } = await applyQueueScope(supabase!.rpc("admin_list_delivery_requests"), scope);
        if (error) return { count: null, error: error.message };
        const rows = (data ?? []) as { approval_status: string }[];
        return { count: rows.filter(r => DELIVERY_AWAITING_DECISION_STATUSES.includes(r.approval_status as never)).length, error: null };
      };

      const manufacturingCount = async (): Promise<{ count: number | null; error: string | null }> => {
        const { data, error } = await applyQueueScope(supabase!.from("orders").select("id").eq("stage", "proforma_issued"), scope);
        if (error) return { count: null, error: error.message };
        const orderIds = (data ?? []).map(r => (r as { id: string }).id);
        if (orderIds.length === 0) return { count: 0, error: null };
        const { count, error: countError } = await supabase!.from("order_deliveries")
          .select("id", { count: "exact", head: true }).in("order_id", orderIds).eq("status", "planned");
        return { count: count ?? 0, error: countError ? countError.message : null };
      };

      const [projectReviews, orders, requests, deliveryRequests, manufacturing] = await Promise.all([
        projectReviewsQ, ordersQ, requestsCount(), deliveryRequestsCount(), manufacturingCount(),
      ]);
      if (cancelled) return;

      const firstError = [projectReviews.error, orders.error, requests.error, deliveryRequests.error, manufacturing.error]
        .find((e): e is string => Boolean(e));
      if (firstError) { setState({ ...EMPTY, loading: false, error: firstError }); return; }

      setState({
        requests: requests.count,
        projectReviews: projectReviews.count ?? 0,
        orders: orders.count ?? 0,
        deliveryRequests: deliveryRequests.count,
        manufacturing: manufacturing.count,
        loading: false, error: null,
      });
    })();

    return () => { cancelled = true; };
  }, [scopeLoading, scopeError, companyKey]);

  return state;
}
