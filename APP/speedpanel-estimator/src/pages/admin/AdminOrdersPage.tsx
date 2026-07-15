// =============================================================================
// Admin > Orders -- submitted-order review queue
// =============================================================================
// One row per order awaiting a decision -- stage 'submitted' (not yet
// requested a pro forma) or 'proforma_requested' (see adminOrdersStore.ts's
// query) -- a queue, not a full order browser, same posture as
// AdminProjectsPage.tsx. Reuses the customer-side OrderLineItemsTable/
// DeliveryBatchCard read-only, and useOrderDeliveries directly (same
// orders/order_deliveries RLS already allows admin reads).
//
// "Revise" opens OrderLineItemsTable in its editablePrice mode (qty AND
// unit price both editable, staff-only -- see that component's header
// comment) so Internal Sales can correct a pricing error before issuing;
// revise_order() requires a note explaining the change and logs
// old-total/new-total to order_revisions (see OrderDetailPage.tsx's
// "Revision History" card, and supabase/schema.sql's "Quote revisions"
// section). "Issue pro forma invoice" only makes sense once an order has
// actually reached 'proforma_requested' -- a 'submitted' row can be
// revised or cancelled, but not issued yet.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { TextAreaField } from "../shared/fields";
import { useAdminOrders } from "./orders/adminOrdersStore";
import { useOrderDeliveries } from "../projects/orders/orderDeliveriesStore";
import { OrderLineItemsTable, type DraftLineItem } from "../projects/orders/OrderLineItemsTable";
import { DeliveryBatchCard } from "../projects/orders/DeliveryBatchCard";
import { round2 } from "../../export/priceEstimateReportData";
import type { OrderRow } from "../projects/orders/orderTypes";
import type { InternalRole } from "../company/staffTypes";

const AdminOrderRow = ({ order, onIssue, onCancel, onRevise }: {
  order: OrderRow;
  onIssue: (id: string, note: string) => Promise<string | null>;
  onCancel: (id: string) => Promise<string | null>;
  onRevise: (id: string, items: DraftLineItem[], note: string) => Promise<string | null>;
}) => {
  const { deliveries } = useOrderDeliveries(order.id);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revising, setRevising] = useState(false);
  const [revisedItems, setRevisedItems] = useState<DraftLineItem[]>([]);
  const [reviseNote, setReviseNote] = useState("");

  const items: DraftLineItem[] = order.line_items.map(i => ({ ...i, included: true }));

  const run = async (action: () => Promise<string | null>) => {
    setSubmitting(true);
    setError(null);
    const err = await action();
    setSubmitting(false);
    if (err) setError(err);
  };

  const startRevise = () => { setRevisedItems(items); setReviseNote(""); setError(null); setRevising(true); };
  const saveRevise = () => run(async () => {
    const included = revisedItems.filter(i => i.included);
    if (included.length === 0) return "Include at least one line item.";
    if (!reviseNote.trim()) return "A note is required when revising an order.";
    const err = await onRevise(order.id, included, reviseNote.trim());
    if (!err) setRevising(false);
    return err;
  });
  // Display-only preview while editing -- the RPC recomputes authoritatively
  // server-side (see revise_order() in schema.sql); this just gives staff
  // live feedback before they save.
  const revisedSubtotal = round2(revisedItems.filter(i => i.included).reduce((sum, i) => sum + i.lineTotalExGst, 0));
  const revisedTotal = round2(revisedSubtotal * (1 + order.gst_rate));

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
          {revising ? (
            <>
              <OrderLineItemsTable items={revisedItems} onChange={setRevisedItems} editablePrice />
              <p className="mt-2 text-sm font-semibold" style={{ color: NAVY }}>New total: ${revisedTotal.toFixed(2)}</p>
              <div className="mt-2">
                <TextAreaField label="Note (required -- what changed and why)" value={reviseNote} onChange={setReviseNote} />
              </div>
              {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={saveRevise} disabled={submitting}
                  className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
                  Save revision
                </button>
                <button onClick={() => setRevising(false)} disabled={submitting} className="text-sm font-semibold" style={{ color: MUTED }}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <OrderLineItemsTable items={items} readOnly />
              <button onClick={startRevise} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Revise</button>
            </>
          )}
        </AccordionCard>
      </div>
      <div className="mt-3">
        <AccordionCard summary={`Deliveries (${deliveries.length})`}>
          {deliveries.map(d => (
            <DeliveryBatchCard key={d.id} delivery={d} lineItems={order.line_items} canRemove={false} onRemove={() => {}} />
          ))}
        </AccordionCard>
      </div>

      {!revising && (
        <>
          <div className="mt-3">
            <TextAreaField label="Note (optional, included with the pro forma)" value={note} onChange={setNote} />
          </div>

          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            {order.stage === "proforma_requested" && (
              <button onClick={() => run(() => onIssue(order.id, note))} disabled={submitting}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                Issue pro forma invoice
              </button>
            )}
            <button onClick={() => run(() => onCancel(order.id))} disabled={submitting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Cancel order
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export const AdminOrdersPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { orders, loading, error, reload, issueProforma, cancelOrder, reviseOrder } = useAdminOrders(userId, staffRole, staffRoleLoading);

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
        <p className={cx.footnote}>No orders awaiting a decision.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {orders.map(o => <AdminOrderRow key={o.id} order={o} onIssue={issueProforma} onCancel={cancelOrder} onRevise={reviseOrder} />)}
    </div>
  );
};
