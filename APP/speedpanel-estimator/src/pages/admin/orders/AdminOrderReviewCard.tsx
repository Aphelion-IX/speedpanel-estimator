
import { useEffect, useMemo, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { TextAreaField } from "../../shared/fields";
import { MUTED, NAVY } from "../../../styleTokens";
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
    <Card title="Order Review" icon={<FileCheck2 size={14} />}>
      {editing ? (
        <>
          <OrderLineItemsTable
            items={items}
            onChange={setItems}
            editablePrice
          />
          <div className="mt-3 max-w-xs ml-auto text-sm">
            <div className="flex justify-between gap-3">
              <span style={{ color: MUTED }}>New total</span>
              <strong style={{ color: NAVY }}>
                ${totals.totalIncGst.toFixed(2)}
              </strong>
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
            <Button
              disabled={busy || !note.trim()}
              onClick={save}
            >
              {busy ? "Saving..." : "Save Revision"}
            </Button>
            <Button
              variant="ghost"
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
            </Button>
          </div>
        </>
      ) : (
        <>
          <OrderLineItemsTable
            items={items}
            readOnly
          />
          {!snapshot && (
            <Button
              variant="secondary"
              className="mt-3"
              onClick={() => setEditing(true)}
            >
              Revise Line Items
            </Button>
          )}
          {snapshot && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
              Accepted order line items are locked.
            </div>
          )}
        </>
      )}

      {(error || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || actionError}
        </p>
      )}
    </Card>
  );
};
