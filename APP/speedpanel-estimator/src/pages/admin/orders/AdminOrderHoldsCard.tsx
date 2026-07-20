
import { useState } from "react";
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
    <div className="ord-section">
      {openHolds.length === 0 ? (
        <div className="ord-section-head"><div><h2>Order Holds</h2><p>No active holds.</p></div></div>
      ) : (
        openHolds.map(hold => (
          <div key={hold.id} className="ord-info-banner red">
            <span className="ord-info-copy">
              <strong>{hold.title}</strong>
              <span>{hold.reason}</span>
              <span>
                {ORDER_HOLD_TYPE_LABELS[hold.hold_type]}
                {hold.customer_visible ? " · Customer visible" : " · Internal only"}
              </span>
            </span>
            <button
              className="ord-btn success"
              disabled={busy}
              onClick={async () => {
                const result = await resolveHold(hold.id);
                if (result) setActionError(result);
              }}
            >
              Release Hold
            </button>
          </div>
        ))
      )}

      <div className="ord-fieldgrid mt-3">
        <div className="ord-field">
          <label>Hold Category</label>
          <select value={holdType} onChange={e => setHoldType(e.target.value as OrderHoldType)}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="ord-field">
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="ord-field full">
          <label>Internal Reason</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="ord-field">
          <label>Customer Visibility</label>
          <select
            value={customerVisible ? "visible" : "internal"}
            onChange={e => setCustomerVisible(e.target.value === "visible")}
          >
            <option value="visible">Customer visible</option>
            <option value="internal">Internal only</option>
          </select>
        </div>
        {customerVisible && (
          <div className="ord-field full">
            <label>Customer Message</label>
            <textarea value={customerMessage} onChange={e => setCustomerMessage(e.target.value)} />
          </div>
        )}
        <div className="ord-field full">
          <button className="ord-btn primary" disabled={busy || !title.trim() || !reason.trim()} onClick={add}>
            {busy ? "Saving..." : "Place Hold"}
          </button>
        </div>
      </div>

      {resolvedHolds.length > 0 && (
        <div className="mt-3">
          <h3 className="ord-small" style={{ fontWeight: 850, marginBottom: 8 }}>Resolved holds ({resolvedHolds.length})</h3>
          <div className="ord-note-list">
            {resolvedHolds.map(hold => (
              <div key={hold.id} className="ord-note-item">
                <strong>{hold.title}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {(error || actionError) && (
        <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>
          {error || actionError}
        </p>
      )}
    </div>
  );
};
