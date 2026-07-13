// =============================================================================
// Order Adjustments -- row types
// =============================================================================
// Mirrors order_adjustments (see supabase/schema.sql's "Quote Adjustments:
// Order Adjustments" section) -- same snake_case-row convention as
// orderTypes.ts's OrderRow/OrderDeliveryRow, since this lives alongside
// them under src/pages/projects/orders/. amount_ex_gst is null only for
// kind='note' (enforced by the table's own check constraint); discount/
// credit rows are already stored NEGATIVE server-side (see
// add_order_adjustment), so no sign logic is needed on read.
// =============================================================================
import { z } from "zod";

export const ORDER_ADJUSTMENT_KINDS = ["delivery", "fee", "discount", "credit", "note"] as const;
export type OrderAdjustmentKind = typeof ORDER_ADJUSTMENT_KINDS[number];

export const ORDER_ADJUSTMENT_KIND_LABELS: Record<OrderAdjustmentKind, string> = {
  delivery: "Delivery", fee: "Fee", discount: "Discount", credit: "Credit", note: "Note",
};

export const OrderAdjustmentRowSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  kind: z.enum(ORDER_ADJUSTMENT_KINDS),
  label: z.string(),
  amount_ex_gst: z.number().nullable(),
  saved_fee_id: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OrderAdjustmentRow = z.infer<typeof OrderAdjustmentRowSchema>;
