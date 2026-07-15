// =============================================================================
// Journey stage -- a DISPLAY-ONLY derived pipeline, never persisted
// =============================================================================
// The mockup this page is modeled on shows one unified 8-step "journey"
// (Estimating -> ... -> Completed). The real schema has no such column --
// it has two ORTHOGONAL state machines: project.stage (draft/install_review/
// technical_review/approved, a design-review pipeline -- see projectTypes.ts)
// and order.stage (draft/submitted/proforma_requested/proforma_issued/
// cancelled, a fulfillment pipeline -- see orders/orderTypes.ts), plus
// manufacturing progress and delivery status on each order. Conflating those
// into one persisted column would recreate this app's own past "stage
// drift" incident (a real E2E-breaking bug from a stage-model mismatch), so
// this mapping stays a small, pure, unit-tested function computed fresh on
// every render from real fields -- never written to the database.
//
// journeyStageForProject() is order-driven, not project.stage-driven:
// project.stage tracks design review, completely independent of whether an
// order has been submitted/paid/manufactured/delivered. Its only role here
// is producing a human sub-label when no order exists yet (see
// estimatingSubLabel()) -- it never changes which of the 8 steps is lit.
// =============================================================================
import { tone } from "../../styleTokens";
import type { ProjectRow } from "./projectTypes";
import { totalPanelCount, type OrderRow } from "./orders/orderTypes";
import type { OrderDeliveryRow } from "./orders/orderTypes";

export const JOURNEY_STAGES = [
  "estimating", "quote_submitted", "quote_accepted", "processing",
  "manufacturing", "ready_for_delivery", "delivered", "completed",
] as const;
export type JourneyStage = typeof JOURNEY_STAGES[number];

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  estimating: "Estimating",
  quote_submitted: "Quote Submitted",
  quote_accepted: "Quote Accepted",
  processing: "Processing",
  manufacturing: "Manufacturing",
  ready_for_delivery: "Ready for Delivery",
  delivered: "Delivered",
  completed: "Completed",
};

// Same shared tone() map as projectTypes.ts's PROJECT_STAGE_BADGE_CLASS /
// orders/orderTypes.ts's ORDER_STAGE_BADGE_CLASS. ready_for_delivery stays a
// literal violet -- it's a progress-ladder-only distinction (so it doesn't
// read identically to processing/manufacturing's "warn"), not a semantic
// status tone the shared map has a slot for.
export const JOURNEY_STAGE_BADGE_CLASS: Record<JourneyStage, string> = {
  estimating: tone("neutral"),
  quote_submitted: tone("info"),
  quote_accepted: tone("info"),
  processing: tone("warn"),
  manufacturing: tone("warn"),
  ready_for_delivery: "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400",
  delivered: tone("ok"),
  completed: tone("ok"),
};

// Only the columns this function actually reads -- keeps the mapping's
// audit surface small and pinned to orderTypes.ts's real enums, rather than
// silently depending on the full OrderRow/OrderDeliveryRow shape.
export type JourneyOrderInput = Pick<OrderRow, "id" | "stage" | "line_items" | "panels_manufactured">;
export type JourneyDeliveryInput = Pick<OrderDeliveryRow, "status">;
export type JourneyProjectInput = Pick<ProjectRow, "stage">;

export interface JourneyOrderGroup {
  order: JourneyOrderInput;
  deliveries: JourneyDeliveryInput[];
}

export interface JourneyResult {
  stage: JourneyStage;
  // The order whose position this project's overall stage was computed
  // from -- null when there are no (non-cancelled) orders yet, i.e. the
  // project is purely in "estimating". Callers use this to source
  // "expected completion"/next-milestone details from the right order.
  representativeOrderId: string | null;
  // Only set in the no-orders "estimating" case -- a project.stage-derived
  // caption ("Install review in progress" etc.), never affects `stage`.
  estimatingNote?: string;
}

// One non-cancelled order's own position in the 8-step ladder (0..6 --
// "completed" is a project-level aggregate, see journeyStageForProject()
// below, never a single order's own state). Exported (not just an internal
// helper) so per-order UI -- ProjectDetailPage.tsx's Orders card, which
// shows each order's own progress rather than the whole project's -- can
// reuse the exact same mapping instead of re-deriving it.
export function journeyStageForOrder(order: JourneyOrderInput, deliveries: JourneyDeliveryInput[]): Exclude<JourneyStage, "completed"> {
  if (order.stage === "draft") return "estimating";
  if (order.stage === "submitted") return "quote_submitted";
  if (order.stage === "proforma_requested") return "quote_accepted";
  // order.stage === "proforma_issued" from here down -- the only stage
  // manufacturing/delivery progress is meaningful for.
  const total = totalPanelCount(order.line_items);
  const made = order.panels_manufactured ?? 0;
  if (!(total > 0 && made >= total)) return made > 0 ? "manufacturing" : "processing";
  const fullyDelivered = deliveries.length > 0 && deliveries.every(d => d.status === "delivered");
  return fullyDelivered ? "delivered" : "ready_for_delivery";
}

const STAGE_RANK: Record<Exclude<JourneyStage, "completed">, number> = Object.fromEntries(
  JOURNEY_STAGES.filter((s): s is Exclude<JourneyStage, "completed"> => s !== "completed").map((s, i) => [s, i]),
) as Record<Exclude<JourneyStage, "completed">, number>;

function estimatingSubLabel(project: JourneyProjectInput): string {
  if (project.stage === "approved") return "Design approved -- ready to request a quote";
  if (project.stage === "technical_review") return "Technical review in progress";
  if (project.stage === "install_review") return "Install review in progress";
  return "Add walls in the estimator to get started";
}

// Project's overall journey position = its single most-advanced
// non-cancelled order (callers exclude cancelled orders before calling --
// a cancelled order shouldn't hold a project back at "processing" forever).
// No orders at all -> "estimating", with a project.stage-derived sub-label.
export function journeyStageForProject(project: JourneyProjectInput, orders: JourneyOrderGroup[]): JourneyResult {
  if (orders.length === 0) {
    return { stage: "estimating", representativeOrderId: null, estimatingNote: estimatingSubLabel(project) };
  }

  let best = orders[0];
  let bestRank = STAGE_RANK[journeyStageForOrder(best.order, best.deliveries)];
  for (const candidate of orders.slice(1)) {
    const rank = STAGE_RANK[journeyStageForOrder(candidate.order, candidate.deliveries)];
    if (rank > bestRank) { best = candidate; bestRank = rank; }
  }
  const stage = journeyStageForOrder(best.order, best.deliveries);

  // "Completed" (the one step with no direct real analog): a strict
  // project-level aggregate on top of journeyStageForOrder()'s own real
  // "delivered" result -- every non-cancelled order for this project has
  // INDEPENDENTLY reached "delivered", using only data that already
  // exists (no new column, no new enum value). Gives the 8th step honest,
  // auditable meaning instead of leaving it permanently dead: one order
  // still in production must NOT count the project as "completed" just
  // because another order of its already shipped.
  if (stage === "delivered" && orders.every(o => journeyStageForOrder(o.order, o.deliveries) === "delivered")) {
    return { stage: "completed", representativeOrderId: best.order.id };
  }
  return { stage, representativeOrderId: best.order.id };
}

// Coarse index/(length-1) progress, with real interpolation inside
// "manufacturing" from panels_manufactured/totalPanelCount -- never a
// fabricated number the way the mockup's static `progress` field is.
export function journeyProgressPercent(stage: JourneyStage, order?: Pick<OrderRow, "line_items" | "panels_manufactured"> | null): number {
  const idx = JOURNEY_STAGES.indexOf(stage);
  const step = 100 / (JOURNEY_STAGES.length - 1);
  const base = idx * step;
  if (stage !== "manufacturing" || !order) return Math.round(base);
  const total = totalPanelCount(order.line_items);
  const within = total > 0 ? (order.panels_manufactured ?? 0) / total : 0;
  return Math.round(base + within * step);
}
