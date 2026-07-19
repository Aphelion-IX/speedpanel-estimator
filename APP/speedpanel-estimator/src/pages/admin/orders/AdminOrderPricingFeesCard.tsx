
import { useState } from "react";
import { CircleDollarSign, Trash2 } from "lucide-react";
import { Card, IconButton, Row } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { Field, SelectField } from "../../shared/fields";
import { MUTED, NAVY } from "../../../styleTokens";
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
    <Card
      title="Pricing & Fees"
      icon={<CircleDollarSign size={14} />}
    >
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
              {adjustment.taxable ? " · GST applies" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <strong className="text-sm" style={{ color: NAVY }}>
              {adjustment.amount_ex_gst < 0 ? "-" : ""}
              ${Math.abs(adjustment.amount_ex_gst).toFixed(2)}
            </strong>
            {!snapshot && (
              <IconButton
                size="sm"
                variant="danger"
                title="Remove adjustment"
                ariaLabel="Remove adjustment"
                onClick={async () => {
                  const result = await removeAdjustment(adjustment.id);
                  if (result) setActionError(result);
                }}
              >
                <Trash2 size={13} />
              </IconButton>
            )}
          </div>
        </div>
      ))}

      <div className="mt-3 max-w-xs space-y-1 ml-auto">
        <Row k="Products" v={`$${totals.subtotalExGst.toFixed(2)}`} dim />
        <Row k="Adjustments" v={`$${totals.adjustmentTotalExGst.toFixed(2)}`} dim />
        <Row k="GST" v={`$${totals.gstAmount.toFixed(2)}`} dim />
        <Row k="Quote Total" v={`$${totals.totalIncGst.toFixed(2)}`} hl />
      </div>

      {snapshot ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          Pricing locked by the accepted commercial snapshot.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Adjustment type"
            value={adjustmentType}
            options={TYPE_OPTIONS}
            onChange={value => {
              const next = value as OrderAdjustmentType;
              setAdjustmentType(next);
              setLabel(ORDER_ADJUSTMENT_TYPE_LABELS[next]);
            }}
          />
          <Field label="Label" value={label} onChange={setLabel} />
          <Field
            label="Amount (ex GST)"
            value={amount}
            onChange={setAmount}
            type="number"
          />
          <SelectField
            label="GST"
            value={taxable ? "taxable" : "not_taxable"}
            options={[
              { value: "taxable", label: "GST applies" },
              { value: "not_taxable", label: "No GST" },
            ]}
            onChange={value => setTaxable(value === "taxable")}
          />
          <div className="sm:col-span-2">
            <Button
              disabled={busy || !amount || !label.trim()}
              onClick={add}
            >
              {busy ? "Adding..." : "Add Adjustment"}
            </Button>
          </div>
        </div>
      )}

      {(error || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || actionError}
        </p>
      )}
    </Card>
  );
};
