// =============================================================================
// Admin > Orders -- pro forma invoice request queue
// =============================================================================
// One row per order currently awaiting a pro forma invoice decision (see
// adminOrdersStore.ts's narrower "stage = proforma_requested" query -- a
// queue, not a full order browser, same posture as AdminProjectsPage.tsx).
// Reuses the customer-side OrderLineItemsTable/DeliveryBatchCard read-only,
// and useOrderDeliveries directly (same orders/order_deliveries RLS already
// allows admin reads).
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { TextAreaField } from "../shared/fields";
import { useAdminOrders } from "./orders/adminOrdersStore";
import { useOrderDeliveries } from "../projects/orders/orderDeliveriesStore";
import { OrderLineItemsTable, type DraftLineItem } from "../projects/orders/OrderLineItemsTable";
import { DeliveryBatchCard } from "../projects/orders/DeliveryBatchCard";
import type { OrderRow } from "../projects/orders/orderTypes";

const AdminOrderRow = ({ order, onIssue, onCancel }: {
  order: OrderRow;
  onIssue: (id: string, note: string) => Promise<string | null>;
  onCancel: (id: string) => Promise<string | null>;
}) => {
  const { deliveries } = useOrderDeliveries(order.id);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items: DraftLineItem[] = order.line_items.map(i => ({ ...i, included: true }));

  const run = async (action: () => Promise<string | null>) => {
    setSubmitting(true);
    setError(null);
    const err = await action();
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold" style={{ color: NAVY }}>Order -- ${order.total_inc_gst.toFixed(2)}</div>
        <div className={cx.footnote}>{new Date(order.proforma_requested_at ?? order.created_at).toLocaleString()}</div>
      </div>
      {order.unpriced_item_count > 0 && (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          {order.unpriced_item_count} item{order.unpriced_item_count !== 1 ? "s" : ""} not priced automatically -- confirm pricing before issuing.
        </p>
      )}

      <div className="mt-3">
        <AccordionCard summary="Line items">
          <OrderLineItemsTable items={items} readOnly />
        </AccordionCard>
      </div>
      <div className="mt-3">
        <AccordionCard summary={`Deliveries (${deliveries.length})`}>
          {deliveries.map(d => (
            <DeliveryBatchCard key={d.id} delivery={d} lineItems={order.line_items} canRemove={false} onRemove={() => {}} />
          ))}
        </AccordionCard>
      </div>

      <div className="mt-3">
        <TextAreaField label="Note (optional, included with the pro forma)" value={note} onChange={setNote} />
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => run(() => onIssue(order.id, note))} disabled={submitting}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Issue pro forma invoice
        </button>
        <button onClick={() => run(() => onCancel(order.id))} disabled={submitting}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          Cancel order
        </button>
      </div>
    </div>
  );
};

export const AdminOrdersPage = () => {
  const { orders, loading, error, reload, issueProforma, cancelOrder } = useAdminOrders();

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No orders awaiting a pro forma invoice.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {orders.map(o => <AdminOrderRow key={o.id} order={o} onIssue={issueProforma} onCancel={cancelOrder} />)}
    </div>
  );
};
