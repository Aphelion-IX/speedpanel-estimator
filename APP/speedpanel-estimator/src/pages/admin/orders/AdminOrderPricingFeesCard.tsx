
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  ORDER_ADJUSTMENT_TYPES,
  ORDER_ADJUSTMENT_TYPE_LABELS,
  type OrderAdjustmentType,
} from "../../projects/orders/orderOperationsTypes";
import { useOrderCommercialSummary } from "../../projects/orders/orderOperationsStore";

const TYPE_OPTIONS = ORDER_ADJUSTMENT_TYPES.map(value => ({
  value,
  label: ORDER_ADJUSTMENT_TYPE_LABELS[value],
}));

export const AdminOrderPricingFeesCard = ({
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
    addAdjustment,
    removeAdjustment,
  } = useOrderCommercialSummary(orderId);
  const [adjustmentType, setAdjustmentType] =
    useState<OrderAdjustmentType>("delivery_fee");
  const [label, setLabel] = useState("Delivery fee");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);

  if (loading || !totals) return null;

  const add = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || !label.trim()) {
      setActionError("Enter a valid label and amount.");
      return;
    }
    setBusy(true);
    setActionError(null);
    const finalAmount =
      ["discount", "credit"].includes(adjustmentType)
        ? -Math.abs(numericAmount)
        : Math.abs(numericAmount);
    const result = await addAdjustment({
      adjustmentType,
      label: label.trim(),
      amountExGst: finalAmount,
      taxable,
    });
    setBusy(false);
    if (result) {
      setActionError(result);
      return;
    }
    setAmount("");
  };

  return (
    <div className="ord-section">
      <div className="ord-section-head">
        <div><h2>Fees</h2></div>
      </div>

      {adjustments.length === 0 ? (
        <p className="ord-small ord-muted">No fees, discounts or credits added yet.</p>
      ) : (
        adjustments.map(adjustment => (
          <div key={adjustment.id} className="ord-quote-line">
            <span>
              {adjustment.label}
              <span className="ord-tiny ord-muted" style={{ display: "block" }}>
                {ORDER_ADJUSTMENT_TYPE_LABELS[adjustment.adjustment_type]}
                {adjustment.taxable ? " · GST applies" : ""}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <strong>
                {adjustment.amount_ex_gst < 0 ? "-" : ""}
                ${Math.abs(adjustment.amount_ex_gst).toFixed(2)}
              </strong>
              {!snapshot && (
                <button
                  className="ord-btn danger"
                  style={{ height: 28, padding: "0 8px" }}
                  title="Remove adjustment"
                  aria-label="Remove adjustment"
                  onClick={async () => {
                    const result = await removeAdjustment(adjustment.id);
                    if (result) setActionError(result);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </span>
          </div>
        ))
      )}

      {!snapshot && (
        <div className="mt-3 ord-fieldgrid">
          <div className="ord-field">
            <label>Adjustment type</label>
            <select
              value={adjustmentType}
              onChange={e => {
                const next = e.target.value as OrderAdjustmentType;
                setAdjustmentType(next);
                setLabel(ORDER_ADJUSTMENT_TYPE_LABELS[next]);
              }}
            >
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="ord-field">
            <label>Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div className="ord-field">
            <label>Amount (ex GST)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="ord-field">
            <label>GST</label>
            <select value={taxable ? "taxable" : "not_taxable"} onChange={e => setTaxable(e.target.value === "taxable")}>
              <option value="taxable">GST applies</option>
              <option value="not_taxable">No GST</option>
            </select>
          </div>
          <div className="ord-field full">
            <button className="ord-btn primary" disabled={busy || !amount || !label.trim()} onClick={add}>
              {busy ? "Adding..." : "Add Adjustment"}
            </button>
          </div>
        </div>
      )}

      {(error || actionError) && (
        <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>
          {error || actionError}
        </p>
      )}

      <div className="ord-section-head mt-4"><div><h2>Quote Total</h2></div></div>
      <div className="ord-quote-total">
        <div className="ord-quote-line"><span>Products</span><strong>${totals.subtotalExGst.toFixed(2)}</strong></div>
        <div className="ord-quote-line"><span>Fees</span><strong>${totals.adjustmentTotalExGst.toFixed(2)}</strong></div>
        <div className="ord-quote-line"><span>GST</span><strong>${totals.gstAmount.toFixed(2)}</strong></div>
        <div className="ord-quote-line total"><span>Total</span><strong>${totals.totalIncGst.toFixed(2)}</strong></div>
      </div>

      {snapshot && (
        <div className="ord-info-banner green mt-3">
          <span className="ord-info-copy"><strong>Locked</strong><span>Pricing locked by the accepted commercial snapshot.</span></span>
        </div>
      )}
    </div>
  );
};
