
import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import {
  Field,
  SelectField,
  TextAreaField,
} from "../../shared/fields";
import { cx, MUTED, NAVY } from "../../../styleTokens";
import {
  ORDER_HOLD_TYPES,
  ORDER_HOLD_TYPE_LABELS,
  type OrderHoldType,
} from "../../projects/orders/orderOperationsTypes";
import { useOrderHolds } from "../../projects/orders/orderOperationsStore";

const TYPE_OPTIONS = ORDER_HOLD_TYPES.map(value => ({
  value,
  label: ORDER_HOLD_TYPE_LABELS[value],
}));

export const AdminOrderHoldsCard = ({
  orderId,
}: {
  orderId: string;
}) => {
  const {
    holds,
    loading,
    error,
    placeHold,
    resolveHold,
  } = useOrderHolds(orderId);
  const [holdType, setHoldType] =
    useState<OrderHoldType>("technical");
  const [title, setTitle] =
    useState("Technical review required");
  const [reason, setReason] = useState("");
  const [customerVisible, setCustomerVisible] =
    useState(true);
  const [customerMessage, setCustomerMessage] =
    useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);

  if (loading) return null;

  const openHolds = holds.filter(
    hold => hold.status === "open",
  );
  const resolvedHolds = holds.filter(
    hold => hold.status === "resolved",
  );

  const add = async () => {
    setBusy(true);
    setActionError(null);
    const result = await placeHold({
      holdType,
      title: title.trim(),
      reason: reason.trim(),
      customerVisible,
      customerMessage:
        customerVisible && customerMessage.trim()
          ? customerMessage.trim()
          : null,
    });
    setBusy(false);
    if (result) {
      setActionError(result);
      return;
    }
    setReason("");
    setCustomerMessage("");
  };

  return (
    <Card title="Order Holds" icon={<ShieldAlert size={14} />}>
      {openHolds.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          No active holds.
        </p>
      ) : (
        <div className="space-y-2">
          {openHolds.map(hold => (
            <div
              key={hold.id}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    {hold.title}
                  </p>
                  <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                    {hold.reason}
                  </p>
                  <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
                    {ORDER_HOLD_TYPE_LABELS[hold.hold_type]}
                    {hold.customer_visible
                      ? " · Customer visible"
                      : " · Internal only"}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    const result = await resolveHold(hold.id);
                    if (result) setActionError(result);
                  }}
                >
                  Resolve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={cx.hr} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Hold type"
          value={holdType}
          options={TYPE_OPTIONS}
          onChange={value =>
            setHoldType(value as OrderHoldType)
          }
        />
        <Field label="Title" value={title} onChange={setTitle} />
        <div className="sm:col-span-2">
          <TextAreaField
            label="Internal reason"
            value={reason}
            onChange={setReason}
          />
        </div>
        <SelectField
          label="Customer visibility"
          value={customerVisible ? "visible" : "internal"}
          options={[
            { value: "visible", label: "Customer visible" },
            { value: "internal", label: "Internal only" },
          ]}
          onChange={value =>
            setCustomerVisible(value === "visible")
          }
        />
        {customerVisible && (
          <div className="sm:col-span-2">
            <TextAreaField
              label="Customer message"
              value={customerMessage}
              onChange={setCustomerMessage}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Button
            disabled={busy || !title.trim() || !reason.trim()}
            onClick={add}
          >
            {busy ? "Saving..." : "Place Hold"}
          </Button>
        </div>
      </div>

      {resolvedHolds.length > 0 && (
        <details className="mt-3">
          <summary
            className="cursor-pointer text-sm font-semibold"
            style={{ color: NAVY }}
          >
            Resolved holds ({resolvedHolds.length})
          </summary>
          <div className="mt-2 space-y-2">
            {resolvedHolds.map(hold => (
              <div
                key={hold.id}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-600"
                style={{ color: MUTED }}
              >
                {hold.title}
              </div>
            ))}
          </div>
        </details>
      )}

      {(error || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || actionError}
        </p>
      )}
    </Card>
  );
};
