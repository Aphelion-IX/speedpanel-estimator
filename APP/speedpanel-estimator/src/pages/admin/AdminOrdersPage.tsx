// =============================================================================
// Admin > Orders -- pro forma invoice request queue
// =============================================================================
// One row per order currently awaiting a pro forma invoice decision (see
// adminOrdersStore.ts's narrower "stage = proforma_requested" query -- a
// queue, not a full order browser, same posture as AdminProjectsPage.tsx).
// Reuses the customer-side OrderLineItemsTable/DeliveryBatchCard read-only,
// and useOrderDeliveries directly (same orders/order_deliveries RLS already
// allows admin reads).
//
// Quote Adjustments: an "Adjustments" AccordionCard sits between "Line
// items" and "Deliveries" -- read-only OrderAdjustmentsList (shared with
// the customer-facing OrderDetailPage.tsx) plus + Delivery / + Saved Fee /
// + Discount / + Credit / + Note buttons that open a small inline form.
// "Edit Line Price" is OrderLineItemsTable's onEditPrice affordance,
// opening a similar small inline form below the line items table.
// =============================================================================
import { useState } from "react";
import { Plus } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { Field, NumField, SelectField, TextAreaField } from "../shared/fields";
import { useAdminOrders } from "./orders/adminOrdersStore";
import { useOrderDeliveries } from "../projects/orders/orderDeliveriesStore";
import { useOrderAdjustments } from "../projects/orders/useOrderAdjustments";
import { OrderLineItemsTable, type DraftLineItem } from "../projects/orders/OrderLineItemsTable";
import { OrderAdjustmentsList } from "../projects/orders/OrderAdjustmentsList";
import { DeliveryBatchCard } from "../projects/orders/DeliveryBatchCard";
import { ORDER_ADJUSTMENT_KIND_LABELS, type OrderAdjustmentKind } from "../projects/orders/orderAdjustmentTypes";
import { useSavedFees } from "./savedFees/savedFeesStore";
import type { OrderRow } from "../projects/orders/orderTypes";
import type { InternalRole } from "../company/staffTypes";

type AddingKind = OrderAdjustmentKind | "savedFee";

const ADJUSTMENT_BUTTONS: { kind: AddingKind; label: string }[] = [
  { kind: "delivery", label: "+ Delivery" },
  { kind: "savedFee", label: "+ Saved Fee" },
  { kind: "discount", label: "+ Discount" },
  { kind: "credit", label: "+ Credit" },
  { kind: "note", label: "+ Note" },
];

const AdminOrderRow = ({ order, onIssue, onCancel, onAddAdjustment, onRemoveAdjustment, onSetLinePrice }: {
  order: OrderRow;
  onIssue: (id: string, note: string) => Promise<string | null>;
  onCancel: (id: string) => Promise<string | null>;
  onAddAdjustment: (orderId: string, kind: string, label: string, amountExGst: number | null, savedFeeId: string | null) => Promise<string | null>;
  onRemoveAdjustment: (orderId: string, adjustmentId: string) => Promise<string | null>;
  onSetLinePrice: (orderId: string, lineItemId: string, unitPriceExGst: number) => Promise<string | null>;
}) => {
  const { deliveries } = useOrderDeliveries(order.id);
  const { adjustments, reload: reloadAdjustments } = useOrderAdjustments(order.id);
  const { savedFees } = useSavedFees();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items: DraftLineItem[] = order.line_items.map(i => ({ ...i, included: true }));

  const [addingKind, setAddingKind] = useState<AddingKind | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [amountDraft, setAmountDraft] = useState("");
  const [savedFeeId, setSavedFeeId] = useState<string | null>(null);
  const [adjError, setAdjError] = useState<string | null>(null);
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [linePriceDraft, setLinePriceDraft] = useState("");
  const [linePriceError, setLinePriceError] = useState<string | null>(null);
  const [linePriceSubmitting, setLinePriceSubmitting] = useState(false);

  const run = async (action: () => Promise<string | null>) => {
    setSubmitting(true);
    setError(null);
    const err = await action();
    setSubmitting(false);
    if (err) setError(err);
  };

  const startAdd = (kind: AddingKind) => {
    setAddingKind(kind);
    setLabelDraft("");
    setAmountDraft("");
    setSavedFeeId(null);
    setAdjError(null);
  };
  const cancelAdd = () => setAddingKind(null);

  const pickSavedFee = (id: string) => {
    setSavedFeeId(id);
    const fee = savedFees.find(f => f.id === id);
    if (fee) {
      setLabelDraft(fee.label);
      setAmountDraft(fee.defaultAmountExGst != null ? String(fee.defaultAmountExGst) : "");
    }
  };

  const submitAdjustment = async () => {
    if (!addingKind) return;
    const kind: OrderAdjustmentKind = addingKind === "savedFee"
      ? (savedFees.find(f => f.id === savedFeeId)?.kind ?? "fee")
      : addingKind;
    if (!labelDraft.trim()) { setAdjError("Enter a label."); return; }
    let amount: number | null = null;
    if (kind !== "note") {
      const parsed = Number(amountDraft);
      if (amountDraft.trim() === "" || Number.isNaN(parsed)) { setAdjError("Enter a valid amount."); return; }
      amount = parsed;
    }
    setAdjSubmitting(true);
    setAdjError(null);
    const err = await onAddAdjustment(order.id, kind, labelDraft.trim(), amount, addingKind === "savedFee" ? savedFeeId : null);
    setAdjSubmitting(false);
    if (err) { setAdjError(err); return; }
    cancelAdd();
    reloadAdjustments();
  };

  const removeAdjustment = async (id: string) => {
    const err = await onRemoveAdjustment(order.id, id);
    if (err) { window.alert(err); return; }
    reloadAdjustments();
  };

  const startEditPrice = (id: string) => {
    const item = items.find(i => i.id === id);
    setEditingLineId(id);
    setLinePriceDraft(item?.unitPriceExGst != null ? String(item.unitPriceExGst) : "");
    setLinePriceError(null);
  };

  const submitLinePrice = async () => {
    if (!editingLineId) return;
    const parsed = Number(linePriceDraft);
    if (linePriceDraft.trim() === "" || Number.isNaN(parsed)) { setLinePriceError("Enter a valid price."); return; }
    setLinePriceSubmitting(true);
    setLinePriceError(null);
    const err = await onSetLinePrice(order.id, editingLineId, parsed);
    setLinePriceSubmitting(false);
    if (err) { setLinePriceError(err); return; }
    setEditingLineId(null);
  };

  const editingItem = editingLineId ? items.find(i => i.id === editingLineId) : null;

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
          <OrderLineItemsTable items={items} readOnly onEditPrice={startEditPrice} />
          {editingItem && (
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>Edit price -- {editingItem.label}</p>
              <div className="mt-2 flex items-center gap-2">
                <input value={linePriceDraft} onChange={e => setLinePriceDraft(e.target.value)} placeholder="Unit price ($)"
                  className={cx.input} style={{ color: NAVY }} />
                <button onClick={submitLinePrice} disabled={linePriceSubmitting}
                  className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
                  {linePriceSubmitting ? "Saving..." : "Save"}
                </button>
                <button onClick={() => setEditingLineId(null)} className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold" style={{ color: NAVY }}>
                  Cancel
                </button>
              </div>
              {linePriceError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{linePriceError}</p>}
            </div>
          )}
        </AccordionCard>
      </div>

      <div className="mt-3">
        <AccordionCard summary={`Adjustments (${adjustments.length})`}>
          <OrderAdjustmentsList adjustments={adjustments} onRemove={removeAdjustment} />

          {!addingKind && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ADJUSTMENT_BUTTONS.map(b => (
                <button key={b.kind} onClick={() => startAdd(b.kind)}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold" style={{ color: BLUE }}>
                  <Plus size={12} /> {b.label.replace("+ ", "")}
                </button>
              ))}
            </div>
          )}

          {addingKind && (
            <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Add {addingKind === "savedFee" ? "saved fee" : ORDER_ADJUSTMENT_KIND_LABELS[addingKind].toLowerCase()}
              </p>
              {addingKind === "savedFee" && (
                <div className="mt-2">
                  <SelectField label="Saved fee" value={savedFeeId ?? ""} onChange={pickSavedFee}
                    options={savedFees.filter(f => f.active).map(f => ({ value: f.id, label: f.label }))} />
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="Label" value={labelDraft} onChange={setLabelDraft} />
                {addingKind !== "note" && (
                  <NumField label="Amount ($)" value={Number(amountDraft) || 0} onChange={v => setAmountDraft(String(v))} />
                )}
              </div>
              {adjError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{adjError}</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={submitAdjustment} disabled={adjSubmitting}
                  className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
                  {adjSubmitting ? "Adding..." : "Add"}
                </button>
                <button onClick={cancelAdd} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-bold" style={{ color: NAVY }}>
                  Cancel
                </button>
              </div>
            </div>
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

export const AdminOrdersPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { orders, loading, error, reload, issueProforma, cancelOrder, addAdjustment, removeAdjustment, setLinePrice } =
    useAdminOrders(userId, staffRole, staffRoleLoading);

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
      {orders.map(o => (
        <AdminOrderRow
          key={o.id} order={o} onIssue={issueProforma} onCancel={cancelOrder}
          onAddAdjustment={addAdjustment} onRemoveAdjustment={removeAdjustment} onSetLinePrice={setLinePrice}
        />
      ))}
    </div>
  );
};
