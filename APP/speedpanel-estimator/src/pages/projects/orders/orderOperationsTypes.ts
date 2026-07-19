
import { z } from "zod";
import { tone } from "../../../styleTokens";

export const ORDER_OPERATIONAL_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_required",
  "quote_issued",
  "accepted",
  "processing",
  "manufacturing",
  "ready_for_delivery",
  "partially_delivered",
  "completed",
  "cancelled",
] as const;

export type OrderOperationalStatus =
  (typeof ORDER_OPERATIONAL_STATUSES)[number];

export const ORDER_ALLOWED_TRANSITIONS:
  Record<OrderOperationalStatus, OrderOperationalStatus[]> = {
    draft: ["submitted", "cancelled"],
    submitted: ["under_review", "cancelled"],
    under_review: ["changes_required", "quote_issued", "cancelled"],
    changes_required: ["under_review", "cancelled"],
    quote_issued: ["accepted", "changes_required", "cancelled"],
    accepted: ["processing"],
    processing: ["manufacturing"],
    manufacturing: ["ready_for_delivery"],
    ready_for_delivery: ["partially_delivered"],
    partially_delivered: [],
    completed: [],
    cancelled: [],
  };

export const ORDER_OPERATIONAL_STATUS_LABELS:
  Record<OrderOperationalStatus, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under Review",
    changes_required: "Changes Required",
    quote_issued: "Quote Issued",
    accepted: "Accepted",
    processing: "Processing",
    manufacturing: "Manufacturing",
    ready_for_delivery: "Ready for Delivery",
    partially_delivered: "Partially Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
  };

export const ORDER_OPERATIONAL_STATUS_BADGE_CLASS:
  Record<OrderOperationalStatus, string> = {
    draft: tone("neutral"),
    submitted: tone("info"),
    under_review: tone("info"),
    changes_required: tone("danger"),
    quote_issued: tone("info"),
    accepted: tone("ok"),
    processing: tone("info"),
    manufacturing: tone("info"),
    ready_for_delivery: tone("info"),
    partially_delivered: tone("info"),
    completed: tone("ok"),
    cancelled: tone("danger"),
  };

export const OrderOperationsRowSchema = z.object({
  order_id: z.string(),
  company_id: z.string().nullable(),
  operational_status: z.enum(ORDER_OPERATIONAL_STATUSES),
  version: z.number().int().positive(),
  assigned_to: z.string().nullable(),
  customer_action_required: z.boolean(),
  customer_action_note: z.string().nullable(),
  commercial_total_inc_gst: z.number().nullable(),
  accepted_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  updated_by: z.string().nullable(),
  updated_at: z.string(),
});
export type OrderOperationsRow =
  z.infer<typeof OrderOperationsRowSchema>;

export const ORDER_ADJUSTMENT_TYPES = [
  "delivery_fee",
  "additional_fee",
  "discount",
  "credit",
] as const;
export type OrderAdjustmentType =
  (typeof ORDER_ADJUSTMENT_TYPES)[number];

export const ORDER_ADJUSTMENT_TYPE_LABELS:
  Record<OrderAdjustmentType, string> = {
    delivery_fee: "Delivery Fee",
    additional_fee: "Additional Fee",
    discount: "Discount",
    credit: "Credit",
  };

export const OrderAdjustmentRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  adjustment_type: z.enum(ORDER_ADJUSTMENT_TYPES),
  label: z.string(),
  amount_ex_gst: z.number(),
  taxable: z.boolean(),
  created_by: z.string(),
  created_at: z.string(),
});
export type OrderAdjustmentRow =
  z.infer<typeof OrderAdjustmentRowSchema>;

export const ORDER_HOLD_TYPES = [
  "technical",
  "pricing",
  "delivery",
  "credit",
  "customer_information",
  "other",
] as const;
export type OrderHoldType = (typeof ORDER_HOLD_TYPES)[number];

export const ORDER_HOLD_TYPE_LABELS: Record<OrderHoldType, string> = {
  technical: "Technical",
  pricing: "Pricing",
  delivery: "Delivery",
  credit: "Credit",
  customer_information: "Customer Information",
  other: "Other",
};

export const ORDER_HOLD_STATUSES = ["open", "resolved"] as const;

export const OrderHoldRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  hold_type: z.enum(ORDER_HOLD_TYPES),
  status: z.enum(ORDER_HOLD_STATUSES),
  title: z.string(),
  reason: z.string().nullable(),
  customer_visible: z.boolean(),
  customer_message: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  resolved_by: z.string().nullable(),
  resolved_at: z.string().nullable(),
});
export type OrderHoldRow = z.infer<typeof OrderHoldRowSchema>;

export const ORDER_DOCUMENT_TYPES = [
  "purchase_order",
  "quote",
  "proforma",
  "order_confirmation",
  "drawing",
  "technical",
  "delivery",
  "proof_of_delivery",
  "invoice",
  "other",
] as const;
export type OrderDocumentType =
  (typeof ORDER_DOCUMENT_TYPES)[number];

export const ORDER_DOCUMENT_TYPE_LABELS:
  Record<OrderDocumentType, string> = {
    purchase_order: "Purchase Order",
    quote: "Quote",
    proforma: "Pro Forma Invoice",
    order_confirmation: "Order Confirmation",
    drawing: "Drawing",
    technical: "Technical Document",
    delivery: "Delivery Document",
    proof_of_delivery: "Proof of Delivery",
    invoice: "Invoice",
    other: "Other",
  };

export const ORDER_DOCUMENT_VISIBILITIES =
  ["customer", "internal"] as const;
export type OrderDocumentVisibility =
  (typeof ORDER_DOCUMENT_VISIBILITIES)[number];

export const OrderDocumentRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  document_type: z.enum(ORDER_DOCUMENT_TYPES),
  visibility: z.enum(ORDER_DOCUMENT_VISIBILITIES),
  uploaded_by: z.string(),
  storage_path: z.string(),
  file_name: z.string(),
  file_size: z.number(),
  content_type: z.string().nullable(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export type OrderDocumentRow =
  z.infer<typeof OrderDocumentRowSchema>;

export const OrderAcceptanceSnapshotRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  line_items: z.array(z.unknown()),
  adjustments: z.array(z.unknown()),
  subtotal_ex_gst: z.number(),
  adjustment_total_ex_gst: z.number(),
  gst_amount: z.number(),
  total_inc_gst: z.number(),
  accepted_by: z.string(),
  accepted_at: z.string(),
});
export type OrderAcceptanceSnapshotRow =
  z.infer<typeof OrderAcceptanceSnapshotRowSchema>;

export const OrderOperationsAuditRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  actor_user_id: z.string().nullable(),
  event_type: z.string(),
  before_value: z.record(z.string(), z.unknown()).nullable(),
  after_value: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
});
export type OrderOperationsAuditRow =
  z.infer<typeof OrderOperationsAuditRowSchema>;

export const OrderCommercialTotalsSchema = z.object({
  subtotalExGst: z.number(),
  adjustmentTotalExGst: z.number(),
  taxableAdjustmentTotalExGst: z.number(),
  gstAmount: z.number(),
  totalIncGst: z.number(),
});
export type OrderCommercialTotals =
  z.infer<typeof OrderCommercialTotalsSchema>;

export const OrderCompletionCheckSchema = z.object({
  canComplete: z.boolean(),
  blockers: z.array(z.string()),
  openHolds: z.number(),
  deliveryCount: z.number(),
  undeliveredDeliveries: z.number(),
});

export const ORDER_DOCUMENTS_BUCKET = "order-documents";

export function formatOrderFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
