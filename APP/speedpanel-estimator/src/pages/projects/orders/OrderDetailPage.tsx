// =============================================================================
// Order detail -- line items, delivery batches, operational status and stage
// actions
// =============================================================================
// Restyled to match UI-DESIGNS/pages/order-submitted.html,
// order-under-review.html, changes-required.html, quote-issued.html,
// order-accepted.html and manufacturing-tracking.html exactly -- see
// ordersTheme.css for the scoped `.ord-*` palette/shape. These six mockups
// share one chassis (crumbs/title/7-stage timeline/info-banner/detail-grid)
// and differ only by `operational_status` -- so, like ProjectDetailPage.tsx's
// Overview tab, this is ONE restyled component whose banner/timeline/
// sidebar content is driven by the real order_operations row (see
// orderOperationsStore.ts's useOrderOperations), not six separate pages.
//
// Legacy stage lifecycle (draft -> submitted -> proforma_requested ->
// proforma_issued/cancelled) still drives "Submit order"/"Request pro forma
// invoice"/line items/revisions/manufacturing/delivery schedule below the
// chassis -- unchanged, per Patch 3's own instruction to keep that workflow
// intact and only add the new operations/commercial/documents cards after
// the primary order card.
// =============================================================================
import { useState } from "react";
import { History, Plus, FileText } from "lucide-react";
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
import { useCompanyStaffTeam } from "../../company/companyStore";
import { staffDisplayName } from "../../company/staffTypes";
import { OrderOperationsCard } from "./OrderOperationsCard";
import { OrderCommercialSummaryCard } from "./OrderCommercialSummaryCard";
import { OrderDocumentsCard } from "./OrderDocumentsCard";
import { useOrderOperations, useOrderHolds } from "./orderOperationsStore";
import { ORDER_OPERATIONAL_STATUS_LABELS, type OrderOperationalStatus } from "./orderOperationsTypes";
import "../../order/ordersTheme.css";

const TIMELINE_LABELS = ["Draft", "Submitted", "Under Review", "Quote Issued", "Accepted", "Manufacturing", "Delivery"];

// Collapses the real 12-value order_operational_status enum onto the
// mockups' 7-column timeline (changes_required is a branch off "Under
// Review", not a forward step; processing/accepted share a column; ready_
// for_delivery/partially_delivered/completed all read as "Delivery" done).
function timelineIndex(status: OrderOperationalStatus): number {
  switch (status) {
    case "draft": return 0;
    case "submitted": return 1;
    case "under_review": case "changes_required": return 2;
    case "quote_issued": return 3;
    case "accepted": case "processing": return 4;
    case "manufacturing": return 5;
    case "ready_for_delivery": case "partially_delivered": case "completed": return 6;
    case "cancelled": return -1;
  }
}

function bannerFor(status: OrderOperationalStatus, holdMessage: string | null, customerActionNote: string | null): { tone: string; headline: string; note: string } | null {
  switch (status) {
    case "submitted": return { tone: "", headline: "Order submitted successfully", note: "A submission snapshot has been created. The Speedpanel team will now review products, pricing, stock and requested delivery dates." };
    case "under_review": return { tone: "", headline: "Speedpanel is reviewing this order", note: "Products, pack quantities, custom manufacture, pricing and delivery availability are being checked." };
    case "changes_required": return { tone: "red", headline: customerActionNote ? customerActionNote : "Changes are required before this order can continue", note: holdMessage ?? "The original submission remains unchanged. Resolve the items above before resubmitting." };
    case "quote_issued": return { tone: "attention", headline: "Your quote is ready for review", note: "Review pricing, fees, delivery assumptions and order conditions before accepting." };
    case "accepted": return { tone: "green", headline: "Your order has been accepted", note: "The order is now moving into processing. Confirmed manufacturing and delivery information will appear here as it becomes available." };
    default: return null;
  }
}

export const OrderDetailPage = ({ orderId, userId, onBack, onViewProforma, onOpenLinkedOrder }: {
  orderId: string; userId: string | null; onBack: () => void; onViewProforma: (orderId: string) => void; onOpenLinkedOrder?: (orderId: string) => void;
}) => {
  const { order, loading, error, reload, submitOrder, requestProformaInvoice, cancelOrder } = useOrder(orderId);
  const { deliveries, loading: deliveriesLoading, error: deliveriesError, addDelivery, removeDelivery, requestDateChange, acceptProposedDate } = useOrderDeliveries(orderId);
  const { revisions } = useOrderRevisions(orderId);
  const { operations } = useOrderOperations(orderId);
  const { holds } = useOrderHolds(orderId);
  const { staff: speedpanelTeam } = useCompanyStaffTeam(order?.company_id ?? null);
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

  const opStatus = operations?.operational_status;
  const activeIndex = opStatus ? timelineIndex(opStatus) : -1;
  const openHoldMessage = holds.find(h => h.status === "open" && h.customer_visible)?.customer_message ?? null;
  const banner = opStatus ? bannerFor(opStatus, openHoldMessage, operations?.customer_action_note ?? null) : null;
  const speedpanelContact = speedpanelTeam.find(m => m.role === "project_manager");

  return (
    <div className="ord-shell mt-2">
      <button onClick={onBack} className="ord-link">&larr; Back to project</button>

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

      <div className="ord-pagehead" style={{ marginTop: 12 }}>
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> {order.order_number ?? `Order ${order.id.slice(0, 8).toUpperCase()}`}</div>
          <h1>{order.order_number ?? `Order ${order.id.slice(0, 8).toUpperCase()}`}</h1>
          <p>{opStatus ? ORDER_OPERATIONAL_STATUS_LABELS[opStatus] : ORDER_STAGE_LABELS[order.stage]}</p>
        </div>
      </div>

      {activeIndex >= 0 && (
        <div className="ord-timeline">
          {TIMELINE_LABELS.map((label, i) => (
            <div key={label} className={`ord-stage ${i < activeIndex ? "done" : i === activeIndex ? "current" : ""}`}>
              <div className="ord-dot">{i < activeIndex ? "✓" : ""}</div>
              <strong>{label}</strong>
              <span>{i < activeIndex ? "" : i === activeIndex ? "Current" : ""}</span>
            </div>
          ))}
        </div>
      )}

      {banner && (
        <div className={`ord-info-banner ${banner.tone}`}>
          <div className="ord-info-icon">i</div>
          <div className="ord-info-copy"><strong>{banner.headline}</strong><span>{banner.note}</span></div>
        </div>
      )}

      <div className="ord-detail-grid">
        <div>
          <section className="ord-card">
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

            {actionError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{actionError}</p>}

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
          </section>

          <div className="mt-4">
            <OrderCommercialSummaryCard orderId={order.id} />
          </div>

          <div className="mt-4">
            <OrderDocumentsCard orderId={order.id} userId={userId} viewerKind="customer" />
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
                <p className="mt-2 text-sm text-red-600 dark:text-red-300">{deliveriesError}</p>
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

        <aside>
          {speedpanelContact && (
            <section className="ord-section">
              <div className="ord-section-head"><div><h2>Speedpanel Contact</h2></div></div>
              <div className="ord-row">
                <span className="ord-row-icon">{staffDisplayName(speedpanelContact).split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div className="ord-row-copy">
                  <strong>{staffDisplayName(speedpanelContact)}</strong>
                  <span>Project Manager{speedpanelContact.phone ? ` · ${speedpanelContact.phone}` : ""}</span>
                </div>
              </div>
            </section>
          )}

          <OrderOperationsCard orderId={order.id} onCreatedOrder={onOpenLinkedOrder} />

          {order.stage === "proforma_issued" && (
            <button onClick={() => onViewProforma(order.id)} className="ord-section" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left" }}>
              <FileText size={16} />
              <span>View pro forma invoice</span>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};
