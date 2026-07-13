// =============================================================================
// Journey milestone copy -- presentational-only text for a JourneyStage
// =============================================================================
// Kept separate from journeyStage.ts so that file's audited stage-computation
// function stays minimal -- this is just label/note text, safe to iterate on
// without touching the mapping logic itself. Shared by ProjectsListPage.tsx's
// "Next Milestone" column and ProjectDetailPage.tsx's "What's Next?" card
// (the latter reads `note` as its longer description line).
// =============================================================================
import type { JourneyStage } from "./journeyStage";
import type { OrderDeliveryRow } from "./orders/orderTypes";

export interface JourneyMilestone {
  label: string;
  note: string;
}

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString();

// The earliest confirmed/requested date among an order's not-yet-delivered
// deliveries -- feeds journeyMilestone's `nextDeliveryDate` input. A
// confirmed_date is preferred over a merely requested_date when both exist
// (it's the one Speedpanel has actually committed to).
export function nextDeliveryDate(deliveries: Pick<OrderDeliveryRow, "status" | "requested_date" | "confirmed_date">[]): string | null {
  const dates = deliveries
    .filter(d => d.status !== "delivered")
    .map(d => d.confirmed_date ?? d.requested_date)
    .filter((d): d is string => !!d)
    .sort();
  return dates[0] ?? null;
}

export interface JourneyMilestoneInput {
  // Only set in the "estimating" case -- see journeyStage.ts's JourneyResult.
  estimatingNote?: string;
  // The representative order's manufacturing_est_completion, when set.
  estCompletion?: string | null;
  // Earliest known/requested delivery date among the representative order's
  // not-yet-delivered deliveries, when any exist.
  nextDeliveryDate?: string | null;
}

export function journeyMilestone(stage: JourneyStage, input: JourneyMilestoneInput = {}): JourneyMilestone {
  switch (stage) {
    case "estimating":
      return { label: "Get a Quote", note: input.estimatingNote ?? "Add walls in the estimator to get started." };
    case "quote_submitted":
      return { label: "Quote Review", note: "Speedpanel is reviewing your order." };
    case "quote_accepted":
      return { label: "Invoice Approval", note: "Waiting on Speedpanel to issue your pro forma invoice." };
    case "processing":
      return {
        label: "Manufacturing",
        note: input.estCompletion ? `We're preparing your order for manufacture. Est. completion ${formatDate(input.estCompletion)}.` : "We're preparing your order for manufacture.",
      };
    case "manufacturing":
      return {
        label: "Ready for Delivery",
        note: input.estCompletion ? `Your order is in production. Est. completion ${formatDate(input.estCompletion)}.` : "Your order is in production.",
      };
    case "ready_for_delivery":
      return {
        label: "Delivery",
        note: input.nextDeliveryDate ? `Scheduled for ${formatDate(input.nextDeliveryDate)}.` : "Awaiting a delivery date.",
      };
    case "delivered":
      return { label: "Delivered", note: "All items for this project have been delivered." };
    case "completed":
      return { label: "Completed", note: "Every order on this project has been delivered." };
  }
}
