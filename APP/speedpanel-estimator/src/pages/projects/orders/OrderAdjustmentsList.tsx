// =============================================================================
// Order Adjustments -- read-only list, shared by OrderDetailPage.tsx
// (customer, always read-only) and AdminOrderRow (Internal Sales, gets a
// Remove action)
// =============================================================================
// onRemove is a no-op unless passed, same "optional prop flips it into the
// editable variant" convention as DeliveryBatchCard's onStatusChange and
// OrderLineItemsTable's onChange/onEditPrice.
// =============================================================================
import { Trash2 } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { ORDER_ADJUSTMENT_KIND_LABELS, type OrderAdjustmentRow } from "./orderAdjustmentTypes";

export const OrderAdjustmentsList = ({ adjustments, onRemove }: {
  adjustments: OrderAdjustmentRow[]; onRemove?: (id: string) => void;
}) => {
  if (adjustments.length === 0) {
    return <p className={cx.footnote} style={{ paddingTop: 0 }}>No adjustments.</p>;
  }

  return (
    <div className="space-y-2">
      {adjustments.map(a => (
        <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cx.badge} style={{ background: "#f1f5f9", color: MUTED }}>{ORDER_ADJUSTMENT_KIND_LABELS[a.kind]}</span>
              <span className="truncate text-sm font-semibold" style={{ color: NAVY }}>{a.label}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {a.amount_ex_gst != null && (
              <span className="text-sm font-semibold" style={{ color: a.amount_ex_gst < 0 ? "#dc2626" : NAVY }}>
                {a.amount_ex_gst < 0 ? "-" : ""}${Math.abs(a.amount_ex_gst).toFixed(2)}
              </span>
            )}
            {onRemove && (
              <button onClick={() => onRemove(a.id)} className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
