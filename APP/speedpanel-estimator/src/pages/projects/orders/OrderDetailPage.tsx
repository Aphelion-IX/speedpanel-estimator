// =============================================================================
// Order detail -- line items, delivery batches, and stage actions
// =============================================================================
// Stage lifecycle: draft -> submitted -> proforma_requested -> proforma_issued
// (+ cancelled). "Submit order" and "Request pro forma invoice" are two
// separate customer steps, not one -- see supabase/schema.sql's
// submit_order/request_proforma_invoice RPCs.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../../styleTokens";
import { Row, WarningsList, Stat } from "../../../ui/primitives";
import { useOrder } from "./orderDetailStore";
import { useOrderDeliveries } from "./orderDeliveriesStore";
import { OrderLineItemsTable, type DraftLineItem } from "./OrderLineItemsTable";
import { DeliveryRequestCard } from "./DeliveryRequestCard";
import { AddDeliveryForm } from "./AddDeliveryForm";
import { ManufacturingProgress } from "./ManufacturingProgress";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS } from "./orderTypes";
import { nextDeliveryDate } from "../journeyCopy";

export const OrderDetailPage = ({ orderId, onBack, onViewProforma }: {
  orderId: string; onBack: () => void; onViewProforma: (orderId: string) => void;
}) => {
  const { order, loading, error, reload, submitOrder, requestProformaInvoice, cancelOrder } = useOrder(orderId);
  const { deliveries, loading: deliveriesLoading, error: deliveriesError, addDelivery, removeDelivery, requestDateChange, acceptProposedDate } = useOrderDeliveries(orderId);
  const [addingDelivery, setAddingDelivery] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error || !order) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Order not found."}</p>
        <button onClick={() => reload()} className="mt-2 mr-4 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to project</button>
      </div>
    );
  }

  const items: DraftLineItem[] = order.line_items.map(i => ({ ...i, included: true }));
  const remaining: Record<string, number> = Object.fromEntries(order.line_items.map(i => [i.id, i.qty]));
  for (const d of deliveries) for (const a of d.item_allocations) remaining[a.lineItemId] = (remaining[a.lineItemId] ?? 0) - a.qty;
  // Staff-created split rows (approval_status='draft') aren't customer-
  // visible yet -- see DeliveryRequestCard's header comment -- but their
  // allocations still count against `remaining` above so a customer can't
  // double-allocate quantity a staff split already claimed.
  const visibleDeliveries = deliveries.filter(d => d.approval_status !== "draft");
  const pendingDeliveryCount = visibleDeliveries.filter(d => d.approval_status === "pending" || d.approval_status === "date_proposed").length;
  const nextDelivery = nextDeliveryDate(visibleDeliveries);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setActionError(null);
    const err = await action();
    setBusy(false);
    if (err) setActionError(err);
  };

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to project</button>

      <div className={`${cx.card} mt-3`}>
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-bold" style={{ color: NAVY }}>Order</h1>
          <span className={`${cx.badge} ${ORDER_STAGE_BADGE_CLASS[order.stage]}`}>{ORDER_STAGE_LABELS[order.stage]}</span>
        </div>
        <p className={cx.footnote}>Created {new Date(order.created_at).toLocaleString()}</p>

        <WarningsList warnings={order.unpriced_item_count > 0
          ? [`${order.unpriced_item_count} item${order.unpriced_item_count !== 1 ? "s" : ""} in this order couldn't be priced automatically.`]
          : null} />

        <div className="mt-4">
          <OrderLineItemsTable items={items} readOnly />
        </div>

        <div className="mt-4 max-w-xs ml-auto space-y-1">
          <Row k="Subtotal (ex GST)" v={`$${order.subtotal_ex_gst.toFixed(2)}`} dim />
          <Row k={`GST (${(order.gst_rate * 100).toFixed(0)}%)`} v={`$${order.gst_amount.toFixed(2)}`} dim />
          <Row k="Total (inc GST)" v={`$${order.total_inc_gst.toFixed(2)}`} hl />
        </div>

        {actionError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{actionError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {order.stage === "draft" && (
            <button onClick={() => run(submitOrder)} disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              Submit order
            </button>
          )}
          {order.stage === "submitted" && (
            <button onClick={() => run(requestProformaInvoice)} disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              Request pro forma invoice
            </button>
          )}
          {order.stage === "proforma_requested" && (
            <p className="text-sm" style={{ color: MUTED }}>Waiting on Speedpanel to issue your pro forma invoice.</p>
          )}
          {order.stage === "proforma_issued" && (
            <button onClick={() => onViewProforma(order.id)} className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
              View pro forma invoice
            </button>
          )}
          {["draft", "submitted", "proforma_requested"].includes(order.stage) && (
            <button onClick={() => { if (window.confirm("Cancel this order?")) run(cancelOrder); }} disabled={busy}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-500 disabled:opacity-50">
              Cancel order
            </button>
          )}
        </div>
      </div>

      {order.stage === "proforma_issued" && (
        <div className="mt-5">
          <div className={cx.cardHd}>Manufacturing</div>
          <div className={`${cx.card} mt-2`}>
            <ManufacturingProgress order={order} />
          </div>
        </div>
      )}

      {order.stage !== "draft" && (
        <div className="mt-5">
          <div className={cx.cardHd}>Delivery Schedule</div>
          <p className={cx.footnote}>Request and manage deliveries for this order. Requested dates remain subject to confirmation by Speedpanel.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat value={visibleDeliveries.length} label="Deliveries" />
            <Stat value={pendingDeliveryCount} label="Pending" />
            <Stat value={nextDelivery ? new Date(nextDelivery).toLocaleDateString() : "—"} label="Next delivery" />
          </div>
          {deliveriesLoading ? (
            <div className={`${cx.card} mt-2 text-sm`} style={{ color: MUTED }}>Loading...</div>
          ) : deliveriesError ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{deliveriesError}</p>
          ) : (
            visibleDeliveries.map(d => (
              <DeliveryRequestCard key={d.id} delivery={d} lineItems={order.line_items}
                onRemove={id => run(() => removeDelivery(id))}
                onAcceptProposedDate={id => run(() => acceptProposedDate(id))}
                onRequestDateChange={(id, newDate) => run(() => requestDateChange(id, newDate))}
              />
            ))
          )}

          {order.stage !== "cancelled" && (
            addingDelivery ? (
              <AddDeliveryForm
                lineItems={order.line_items} remaining={remaining}
                onAdd={async input => { const err = await addDelivery(input); if (!err) setAddingDelivery(false); return err; }}
                onCancel={() => setAddingDelivery(false)}
              />
            ) : (
              <button onClick={() => setAddingDelivery(true)} className="mt-3 text-sm font-bold" style={{ color: BLUE }}>
                + Request a delivery
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
