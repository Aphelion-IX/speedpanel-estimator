// =============================================================================
// Orders -- row types
// =============================================================================
// Mirrors the orders/order_deliveries tables' columns verbatim (see
// supabase/schema.sql) -- snake_case, not camelCase, same convention as
// projectTypes.ts's ProjectRow/requestTypes.ts's AdminRequestRow (Products'
// productTypes.ts is the one place in this codebase that maps to camelCase,
// via its own dedicated productMappers.ts; Orders lives under
// src/pages/projects/ alongside ProjectRow, so it follows that sibling's
// convention instead).
//
// line_items/item_allocations are jsonb blobs holding plain client-generated
// JS objects (see src/export/priceEstimateReportData.ts's OrderLineItem) --
// those stay camelCase since they're opaque to Postgres, not real columns.
// =============================================================================
import { z } from "zod";
import { tone } from "../../../styleTokens";
import { OrderLineItemSchema, type OrderLineItem } from "../../../export/priceEstimateReportData";

export const ORDER_STAGES = ["draft", "submitted", "proforma_requested", "proforma_issued", "cancelled"] as const;
export type OrderStage = typeof ORDER_STAGES[number];

export const ORDER_STAGE_LABELS: Record<OrderStage, string> = {
  draft: "Draft",
  submitted: "Submitted",
  proforma_requested: "Pro forma requested",
  proforma_issued: "Pro forma issued",
  cancelled: "Cancelled",
};

// Was local to OrderDetailPage.tsx as STAGE_BADGE_CLASS -- exported here so
// ProjectDashboard.tsx's orders list can share the same colour convention.
// proforma_requested stays "info" (not "warn"/amber) per the Orders palette
// cleanup -- this app's Orders screens are scoped to blue/neutral/cyan/red/
// green only, no amber/gold/purple.
export const ORDER_STAGE_BADGE_CLASS: Record<OrderStage, string> = {
  draft: tone("neutral"),
  submitted: tone("info"),
  proforma_requested: tone("info"),
  proforma_issued: tone("ok"),
  cancelled: tone("danger"),
};

export const OrderRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  owner_id: z.string(),
  stage: z.enum(ORDER_STAGES),
  line_items: z.array(OrderLineItemSchema),
  subtotal_ex_gst: z.number(),
  gst_rate: z.number(),
  gst_amount: z.number(),
  total_inc_gst: z.number(),
  unpriced_item_count: z.number(),
  customer_note: z.string().nullable(),
  submitted_at: z.string().nullable(),
  proforma_requested_at: z.string().nullable(),
  proforma_issued_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  // Admin-editable manufacturing tracking (see supabase/schema.sql) -- null
  // panels_manufactured means "not started/no data yet", not a real 0. Total
  // panel count is deliberately not a column -- see totalPanelCount() below.
  panels_manufactured: z.number().nullable(),
  manufacturing_est_completion: z.string().nullable(),
  // Mirrors the parent project's company_id (see supabase/schema.sql's
  // sync_order_company_id trigger) -- null for an ordinary solo order.
  company_id: z.string().nullable(),
  // Company Accounts & Pricing Phase 10: the company's assigned list's
  // currently-effective version at order-creation time (set by
  // create_order()), or null for a solo/no-list project. A traceability
  // snapshot only -- see the column's own comment in supabase/schema.sql.
  price_list_version_id: z.string().nullable(),
  // Orders Operations fields (see supabase/schema.sql) -- order_number is
  // server-assigned (assign_order_number()), nullable only because rows
  // created before this column existed have none until backfilled.
  order_number: z.string().nullable(),
  order_kind: z.enum(["standard", "repeat", "amendment"]),
  source_order_id: z.string().nullable(),
  purchase_order_reference: z.string().nullable(),
  customer_required_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrderRow = z.infer<typeof OrderRowSchema>;

// Sums line items that are actual panels (stock or custom) -- the
// admin-facing "out of how many" denominator for panels_manufactured, and
// the customer-facing progress display. Computed from the order's own
// line_items rather than stored, so it can never drift out of sync.
export function totalPanelCount(lineItems: OrderLineItem[]): number {
  return lineItems
    .filter(li => li.category === "panel" || li.category === "custom_panel")
    .reduce((sum, li) => sum + li.qty, 0);
}

// Scoped, local mirror of dashboardStore.ts's useOrdersSummary aggregation
// (same "exclude cancelled from totalValue" rule), but over an already-
// in-hand orders array instead of its own fetch -- for ProjectDetailPage's
// summary, which already has `orders` loaded.
export function summarizeOrders(orders: Pick<OrderRow, "stage" | "total_inc_gst" | "unpriced_item_count">[]):
  { count: number; totalValue: number; unpricedCount: number } {
  const live = orders.filter(o => o.stage !== "cancelled");
  return {
    count: live.length,
    totalValue: live.reduce((sum, o) => sum + o.total_inc_gst, 0),
    unpricedCount: live.reduce((sum, o) => sum + o.unpriced_item_count, 0),
  };
}

export const OrderDeliveryItemAllocationSchema = z.object({ lineItemId: z.string(), qty: z.number() });
export type OrderDeliveryItemAllocation = z.infer<typeof OrderDeliveryItemAllocationSchema>;

export const DELIVERY_STATUSES = ["planned", "scheduled", "in_transit", "delivered"] as const;
export type DeliveryStatus = typeof DELIVERY_STATUSES[number];

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  planned: "Planned",
  scheduled: "Scheduled",
  in_transit: "In transit",
  delivered: "Delivered",
};

// scheduled uses the shared "info" tone, not a literal purple -- the Orders
// palette cleanup scopes every Orders badge to blue/neutral/cyan/red/green.
export const DELIVERY_STATUS_BADGE_CLASS: Record<DeliveryStatus, string> = {
  planned: tone("neutral"),
  scheduled: tone("info"),
  in_transit: tone("info"),
  delivered: tone("ok"),
};

// Approval status governs the delivery request/negotiation phase (customer
// requests a date, staff accept/propose/decline it) -- independent of and
// coexisting with the fulfillment `status` above (planned/scheduled/
// in_transit/delivered, dispatch-set once a delivery is actually confirmed).
// Neither column constrains the other server-side -- see supabase/schema.sql's
// "Delivery request/approval workflow" section.
export const DELIVERY_APPROVAL_STATUSES = ["draft", "pending", "accepted", "date_proposed", "declined"] as const;
export type DeliveryApprovalStatus = typeof DELIVERY_APPROVAL_STATUSES[number];

export const DELIVERY_APPROVAL_STATUS_LABELS: Record<DeliveryApprovalStatus, string> = {
  draft: "Draft",
  pending: "Pending approval",
  accepted: "Accepted",
  date_proposed: "Date change proposed",
  declined: "Declined",
};

// Rows still needing a staff decision -- shared by AdminDeliveryRequestsPage.tsx
// (per-row action buttons) and useWorkflowCounts.ts (the Delivery Requests
// tile badge), so the two can't drift apart.
export const DELIVERY_AWAITING_DECISION_STATUSES: DeliveryApprovalStatus[] = ["draft", "pending", "date_proposed"];

// Reuses the shared tone() map -- date_proposed is "info", not "danger",
// since that means an actual rejection (declined), not just an alternative
// date being offered. pending is also "info" (not "warn"/amber) per the
// Orders palette cleanup.
export const DELIVERY_APPROVAL_STATUS_BADGE_CLASS: Record<DeliveryApprovalStatus, string> = {
  draft: tone("neutral"),
  pending: tone("info"),
  accepted: tone("ok"),
  date_proposed: tone("info"),
  declined: tone("danger"),
};

// Deliberately excludes internal_note -- that column is revoked from
// `authenticated`'s SELECT grant at the DB level (see schema.sql), so it
// never comes back on a plain `.select(...)` and has no place in this row
// shape; the only place it appears is admin_list_delivery_requests()'s own
// richer row shape (see adminDeliveryRequestsStore.ts).
export const OrderDeliveryRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  sequence_no: z.number(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  suburb: z.string(),
  state: z.string(),
  postcode: z.string(),
  requested_date: z.string().nullable(),
  proposed_date: z.string().nullable(),
  confirmed_date: z.string().nullable(),
  actual_date: z.string().nullable(),
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  delivery_instructions: z.string().nullable(),
  preferred_window: z.string().nullable(),
  site_access_details: z.string().nullable(),
  customer_note: z.string().nullable(),
  item_allocations: z.array(OrderDeliveryItemAllocationSchema),
  status: z.enum(DELIVERY_STATUSES),
  approval_status: z.enum(DELIVERY_APPROVAL_STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrderDeliveryRow = z.infer<typeof OrderDeliveryRowSchema>;
