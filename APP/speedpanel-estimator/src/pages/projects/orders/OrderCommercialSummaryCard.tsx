
import { ReceiptText } from "lucide-react";
import { Card, Row } from "../../../ui/primitives";
import { LoadingState } from "../../../ui/states";
import { cx, MUTED, NAVY } from "../../../styleTokens";
import { ORDER_ADJUSTMENT_TYPE_LABELS } from "./orderOperationsTypes";
import { useOrderCommercialSummary } from "./orderOperationsStore";

export const OrderCommercialSummaryCard = ({
  orderId,
}: {
  orderId: string;
}) => {
  const {
    adjustments,
    totals,
    snapshot,
    loading,
    error,
  } = useOrderCommercialSummary(orderId);

  if (loading) {
    return <LoadingState label="Loading commercial summary" />;
  }
  if (!totals) return null;

  const displayTotals = snapshot
    ? {
        subtotalExGst: snapshot.subtotal_ex_gst,
        adjustmentTotalExGst:
          snapshot.adjustment_total_ex_gst,
        gstAmount: snapshot.gst_amount,
        totalIncGst: snapshot.total_inc_gst,
      }
    : totals;

  return (
    <Card title="Commercial Summary" icon={<ReceiptText size={14} />}>
      {adjustments.length > 0 && (
        <div className="space-y-2">
          {adjustments.map(adjustment => (
            <div
              key={adjustment.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-600"
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  {adjustment.label}
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  {ORDER_ADJUSTMENT_TYPE_LABELS[adjustment.adjustment_type]}
                </p>
              </div>
              <strong className="text-sm" style={{ color: NAVY }}>
                {adjustment.amount_ex_gst < 0 ? "-" : ""}
                ${Math.abs(adjustment.amount_ex_gst).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <div className="ml-auto mt-3 max-w-xs space-y-1">
        <Row k="Products (ex GST)" v={`$${displayTotals.subtotalExGst.toFixed(2)}`} dim />
        <Row k="Fees / adjustments (ex GST)" v={`$${displayTotals.adjustmentTotalExGst.toFixed(2)}`} dim />
        <Row k="GST" v={`$${displayTotals.gstAmount.toFixed(2)}`} dim />
        <Row k="Total (inc GST)" v={`$${displayTotals.totalIncGst.toFixed(2)}`} hl />
      </div>

      {snapshot && (
        <p className={cx.footnote}>
          Accepted commercial snapshot ·{" "}
          {new Date(snapshot.accepted_at).toLocaleString()}
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </Card>
  );
};
