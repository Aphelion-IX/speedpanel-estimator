
import { useEffect, useMemo, useState } from "react";
import { TextAreaField } from "../../shared/fields";
import { round2 } from "../../../export/priceEstimateReportData";
import { useOrder } from "../../projects/orders/orderDetailStore";
import {
  OrderLineItemsTable,
  type DraftLineItem,
} from "../../projects/orders/OrderLineItemsTable";
import { useOrderCommercialSummary } from "../../projects/orders/orderOperationsStore";
import { supabase } from "../../../lib/supabaseClient";

const NOT_CONFIGURED =
  "Orders aren't configured for this environment.";

export const AdminOrderReviewCard = ({
  orderId,
}: {
  orderId: string;
}) => {
  const { order, loading, error, reload } = useOrder(orderId);
  const { snapshot, reload: reloadCommercial } =
    useOrderCommercialSummary(orderId);
  const [items, setItems] = useState<DraftLineItem[]>([]);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!order) return;
    setItems(
      order.line_items.map(item => ({
        ...item,
        included: true,
      })),
    );
  }, [order]);

  const totals = useMemo(() => {
    if (!order) return null;
    const included = items.filter(item => item.included);
    const subtotalExGst = round2(
      included.reduce(
        (sum, item) => sum + item.lineTotalExGst,
        0,
      ),
    );
    const gstAmount = round2(
      subtotalExGst * order.gst_rate,
    );
    return {
      included,
      subtotalExGst,
      gstAmount,
      totalIncGst: round2(subtotalExGst + gstAmount),
    };
  }, [items, order]);

  if (loading || !order || !totals) return null;

  const save = async () => {
    if (!supabase) {
      setActionError(NOT_CONFIGURED);
      return;
    }
    if (!note.trim()) {
      setActionError("A revision note is required.");
      return;
    }
    if (totals.included.length === 0) {
      setActionError("Include at least one line item.");
      return;
    }

    setBusy(true);
    setActionError(null);
    const { error: reviseError } = await supabase.rpc(
      "revise_operational_order",
      {
        p_order_id: orderId,
        p_line_items: totals.included,
        p_note: note.trim(),
      },
    );
    setBusy(false);

    if (reviseError) {
      setActionError(reviseError.message);
      return;
    }

    setEditing(false);
    setNote("");
    await Promise.all([reload(), reloadCommercial()]);
  };

  return (
    <div className="ord-section">
      <div className="ord-section-head">
        <div>
          <h2>Customer Submission</h2>
          <p>{order.submitted_at ? `Submitted ${new Date(order.submitted_at).toLocaleDateString()}` : "Not yet submitted"}{editing ? " · Editing" : ""}</p>
        </div>
      </div>

      {editing ? (
        <>
          <OrderLineItemsTable
            items={items}
            onChange={setItems}
            editablePrice
          />
          <div className="mt-3 ord-quote-total max-w-xs ml-auto">
            <div className="ord-quote-line total">
              <span>New total</span>
              <strong>${totals.totalIncGst.toFixed(2)}</strong>
            </div>
          </div>
          <div className="mt-3">
            <TextAreaField
              label="Revision note"
              value={note}
              onChange={setNote}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="ord-btn primary"
              disabled={busy || !note.trim()}
              onClick={save}
            >
              {busy ? "Saving..." : "Save Revision"}
            </button>
            <button
              className="ord-btn secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setNote("");
                setItems(
                  order.line_items.map(item => ({
                    ...item,
                    included: true,
                  })),
                );
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <OrderLineItemsTable
            items={items}
            readOnly
          />
          {!snapshot && (
            <button
              className="ord-btn secondary mt-3"
              onClick={() => setEditing(true)}
            >
              Revise Line Items
            </button>
          )}
          {snapshot && (
            <div className="ord-info-banner green mt-3">
              <span className="ord-info-copy"><strong>Locked</strong><span>Accepted order line items are locked.</span></span>
            </div>
          )}
        </>
      )}

      {(error || actionError) && (
        <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>
          {error || actionError}
        </p>
      )}
    </div>
  );
};
