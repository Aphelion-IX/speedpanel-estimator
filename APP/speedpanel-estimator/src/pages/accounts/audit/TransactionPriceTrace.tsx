// =============================================================================
// Company Accounts & Pricing -- Transaction Price Trace
// =============================================================================
// A drill-down sidecard for a pricing_used_in_order audit row -- reads
// straight off the order's own already-frozen fields (line_items,
// price_list_version_id -- see create_order()'s own comment in
// supabase/schema.sql), no new storage, per the plan's own instruction.
// A plain table select, not an RPC: staff already reach any order via
// can_view_project()'s is_admin() branch (see the "Owners, company, and
// admins can read orders" RLS policy), the same way OrderDetailPage.tsx's
// own staff view does.
// =============================================================================
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { NAVY, MUTED } from "../../../styleTokens";
import { LoadingState, ErrorState } from "../../../ui/states";
import { OrderLineItemsTable, type DraftLineItem } from "../../projects/orders/OrderLineItemsTable";
import { OrderLineItemSchema } from "../../../export/priceEstimateReportData";

const TraceOrderRowSchema = z.object({
  id: z.string(),
  order_number: z.string().nullable(),
  line_items: z.array(OrderLineItemSchema),
  subtotal_ex_gst: z.number(),
  gst_amount: z.number(),
  total_inc_gst: z.number(),
  created_at: z.string(),
  price_list_versions: z.object({
    version_number: z.number(),
    price_lists: z.object({ name: z.string() }).nullable(),
  }).nullable(),
});
type TraceOrderRow = z.infer<typeof TraceOrderRowSchema>;

const NOT_CONFIGURED = "Not configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const TransactionPriceTrace = ({ orderId }: { orderId: string }) => {
  const [row, setRow] = useState<TraceOrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabase) { setError(NOT_CONFIGURED); setLoading(false); return; }
    setLoading(true);
    setError(null);
    supabase.from("orders")
      .select("id, order_number, line_items, subtotal_ex_gst, gst_amount, total_inc_gst, created_at, price_list_versions(version_number, price_lists(name))")
      .eq("id", orderId).maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); setLoading(false); return; }
        if (!data) { setError("Order not found."); setLoading(false); return; }
        const parsed = TraceOrderRowSchema.safeParse(data);
        if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
        setRow(parsed.data);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orderId]);

  if (loading) return <LoadingState className="mt-3" label="Loading price trace" />;
  if (error) return <ErrorState className="mt-3" message={error} />;
  if (!row) return null;

  const draftItems: DraftLineItem[] = row.line_items.map(li => ({ ...li, included: true }));
  const plLabel = row.price_list_versions
    ? `${row.price_list_versions.price_lists?.name ?? "Price list"} · v${row.price_list_versions.version_number}`
    : "No price list version (solo project or unpriced order)";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold" style={{ color: NAVY }}>
          Order {row.order_number ?? row.id.slice(0, 8)}
        </div>
        <div className="text-xs" style={{ color: MUTED }}>Priced against {plLabel}</div>
      </div>

      <div className="mt-3">
        <OrderLineItemsTable items={draftItems} readOnly />
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-6 text-sm">
        <span style={{ color: MUTED }}>Subtotal (ex GST): <strong style={{ color: NAVY }}>${row.subtotal_ex_gst.toFixed(2)}</strong></span>
        <span style={{ color: MUTED }}>GST: <strong style={{ color: NAVY }}>${row.gst_amount.toFixed(2)}</strong></span>
        <span style={{ color: MUTED }}>Total (inc GST): <strong style={{ color: NAVY }}>${row.total_inc_gst.toFixed(2)}</strong></span>
      </div>
    </div>
  );
};
