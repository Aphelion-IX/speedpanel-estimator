// =============================================================================
// Order detail -- line items, delivery batches, and stage actions
// =============================================================================
// Stage lifecycle: draft -> submitted -> proforma_requested -> proforma_issued
// (+ cancelled). "Submit order" and "Request pro forma invoice" are two
// separate customer steps, not one -- see supabase/schema.sql's
// submit_order/request_proforma_invoice RPCs.
// =============================================================================
import { useState } from "react";
import { History, Plus } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../../styleTokens";
import { Row, WarningsList, Stat, Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState } from "../../../ui/states";
import { ConfirmDialog } from "../../../ui/confirmDialog";
import { useOrder } from "./orderDetailStore";
import { useOrderDeliveries } from "./orderDeliveriesStore";
import { OrderLineItemsTable, type DraftLineItem } from "./OrderLineItemsTable";
import { DeliveryRequestCard } from "./DeliveryRequestCard";
import { AddDeliveryForm } from "./AddDeliveryForm";
import { ManufacturingProgress } from "./ManufacturingProgress";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS } from "./orderTypes";
import { nextDeliveryDate } from "../journeyCopy";
import { useOrderRevisions } from "./orderRevisionsStore";
import { relativeTime } from "../projectActivityStore";

export const OrderDetailPage = ({ orderId, onBack, onViewProforma }: {
  orderId: string; onBack: () => void; onViewProforma: (orderId: string) => void;
}) => {
  const { order, loading, error, reload, submitOrder, requestProformaInvoice, cancelOrder } = useOrder(orderId);
  const { deliveries, loading: deliveriesLoading, error: deliveriesError, addDelivery, removeDelivery, requestDateChange, acceptProposedDate } = useOrderDeliveries(orderId);
  const { revisions } = useOrderRevisions(orderId);
  const [addingDelivery, setAddingDelivery] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (loading) return <LoadingState className="mt-6" label="Loading order" />;

  if (error || !order) {
    return (
      <div className="mt-6">
        <ErrorState message={error || "Order not found."} onRetry={() => reload()} />
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

      <ConfirmDialog
        open={confirmCancel}
        danger
        title="Cancel this order?"
        description="This can't be undone."
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); run(cancelOrder); }}
      />

      <div className={`${cx.card} mt-3`}>
        <div className="flex items-start justify-between gap-2">
          <h1 className={cx.h1}>Order</h1>
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
            <Button onClick={() => run(submitOrder)} disabled={busy}>Submit order</Button>
          )}
          {order.stage === "submitted" && (
            <Button onClick={() => run(requestProformaInvoice)} disabled={busy}>Request pro forma invoice</Button>
          )}
          {order.stage === "proforma_requested" && (
            <p className="text-sm" style={{ color: MUTED }}>Waiting on Speedpanel to issue your pro forma invoice.</p>
          )}
          {order.stage === "proforma_issued" && (
            <Button onClick={() => onViewProforma(order.id)}>View pro forma invoice</Button>
          )}
          {["draft", "submitted", "proforma_requested"].includes(order.stage) && (
            <Button variant="danger" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel order</Button>
          )}
        </div>
      </div>

      {revisions.length > 0 && (
        <Card title="Revision History" icon={<History size={14} />}>
          <div className="space-y-3">
            {revisions.map(r => (
              <div key={r.id} className={cx.rowBorder}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>
                    ${r.old_total_inc_gst.toFixed(2)} &rarr; ${r.new_total_inc_gst.toFixed(2)}
                  </span>
                  <span className={cx.footnote} style={{ paddingTop: 0 }}>{relativeTime(r.created_at)}</span>
                </div>
                <p className={cx.footnote}>{r.note}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

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
            <LoadingState className="mt-2" label="Loading deliveries" />
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
              <Button variant="ghost" icon={<Plus size={14} />} className="mt-3" onClick={() => setAddingDelivery(true)}>
                Request a delivery
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
};
