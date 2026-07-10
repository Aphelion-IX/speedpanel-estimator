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
export const ORDER_STAGE_BADGE_CLASS: Record<OrderStage, string> = {
  draft: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  submitted: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  proforma_requested: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  proforma_issued: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400",
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

export const DELIVERY_STATUS_BADGE_CLASS: Record<DeliveryStatus, string> = {
  planned: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  scheduled: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400",
  in_transit: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  delivered: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
};

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
  contact_name: z.string().nullable(),
  contact_phone: z.string().nullable(),
  notes: z.string().nullable(),
  item_allocations: z.array(OrderDeliveryItemAllocationSchema),
  status: z.enum(DELIVERY_STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrderDeliveryRow = z.infer<typeof OrderDeliveryRowSchema>;
