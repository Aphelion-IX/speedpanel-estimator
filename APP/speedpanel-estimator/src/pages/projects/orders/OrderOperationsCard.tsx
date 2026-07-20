
import { useState } from "react";
import { CheckCircle2, Copy, MessageSquareText } from "lucide-react";
import {
  ORDER_HOLD_TYPE_LABELS,
  ORDER_OPERATIONAL_STATUS_LABELS,
  type OrderOperationalStatus,
} from "./orderOperationsTypes";
import { useOrderHolds, useOrderOperations } from "./orderOperationsStore";

const ORD_STATUS_BADGE_TONE: Record<OrderOperationalStatus, string> = {
  draft: "neutral", submitted: "", under_review: "", changes_required: "red",
  quote_issued: "", accepted: "green", processing: "", manufacturing: "",
  ready_for_delivery: "", partially_delivered: "", completed: "green", cancelled: "red",
};

export const OrderOperationsCard = ({
  orderId,
  onCreatedOrder,
}: {
  orderId: string;
  onCreatedOrder?: (orderId: string) => void;
}) => {
  const {
    operations,
    loading,
    error,
    acceptQuote,
    requestChanges,
    createLinkedDraft,
  } = useOrderOperations(orderId);
  const { holds, loading: holdsLoading, error: holdsError } =
    useOrderHolds(orderId);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading || holdsLoading || !operations) return null;
  const openHolds = holds.filter(hold => hold.status === "open");

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setActionError(null);
    const result = await action();
    setBusy(false);
    if (result) setActionError(result);
  };

  const createCopy = async (kind: "repeat" | "amendment") => {
    setBusy(true);
    setActionError(null);
    const result = await createLinkedDraft(
      kind,
      kind === "amendment" ? "Customer requested an amendment." : undefined,
    );
    setBusy(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    if (result.id) onCreatedOrder?.(result.id);
  };

  const canAccept =
    operations.operational_status === "quote_issued" &&
    openHolds.length === 0;

  return (
    <div className="ord-section">
      <div className="ord-section-head"><div><h2>Order Status</h2></div></div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`ord-badge ${ORD_STATUS_BADGE_TONE[operations.operational_status]}`}>
          {ORDER_OPERATIONAL_STATUS_LABELS[operations.operational_status]}
        </span>
        {operations.customer_action_required && (
          <span className="ord-badge red">Action Required</span>
        )}
      </div>

      {operations.customer_action_note && (
        <div className="ord-info-banner red mt-3">
          <span className="ord-info-copy">{operations.customer_action_note}</span>
        </div>
      )}

      {openHolds.length > 0 && (
        openHolds.map(hold => (
          <div key={hold.id} className="ord-info-banner red mt-3">
            <span className="ord-info-copy">
              <strong>{hold.title}</strong>
              <span>{hold.customer_message || "Speedpanel is reviewing this order."}</span>
              <span>{ORDER_HOLD_TYPE_LABELS[hold.hold_type]}</span>
            </span>
          </div>
        ))
      )}

      {requestingChanges ? (
        <div className="mt-3 ord-fieldgrid">
          <div className="ord-field full">
            <label>What needs to change?</label>
            <textarea value={changeNote} onChange={e => setChangeNote(e.target.value)} />
          </div>
          <div className="ord-field full flex flex-wrap gap-2">
            <button
              className="ord-btn primary"
              disabled={busy || !changeNote.trim()}
              onClick={() =>
                run(async () => {
                  const result = await requestChanges(
                    changeNote.trim(),
                    operations.version,
                  );
                  if (!result) {
                    setRequestingChanges(false);
                    setChangeNote("");
                  }
                  return result;
                })
              }
            >
              Submit Changes
            </button>
            <button className="ord-btn secondary" onClick={() => setRequestingChanges(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {operations.operational_status === "quote_issued" && (
            <>
              <button
                className="ord-btn primary"
                disabled={!canAccept || busy}
                onClick={() => run(() => acceptQuote(operations.version))}
              >
                <CheckCircle2 size={14} /> Accept Quote
              </button>
              <button
                className="ord-btn secondary"
                disabled={busy}
                onClick={() => setRequestingChanges(true)}
              >
                <MessageSquareText size={14} /> Request Changes
              </button>
            </>
          )}

          {["accepted", "processing", "manufacturing", "ready_for_delivery", "partially_delivered", "completed"].includes(operations.operational_status) && (
            <button
              className="ord-btn secondary"
              disabled={busy}
              onClick={() => createCopy("repeat")}
            >
              <Copy size={14} /> Repeat Order
            </button>
          )}

          {["accepted", "processing", "manufacturing", "ready_for_delivery", "partially_delivered"].includes(operations.operational_status) && (
            <button
              className="ord-btn secondary"
              disabled={busy}
              onClick={() => createCopy("amendment")}
            >
              Create Amendment
            </button>
          )}
        </div>
      )}

      <p className="ord-tiny ord-muted mt-2">
        Accepted orders are locked. Later changes create a linked amendment
        instead of altering the accepted order.
      </p>

      {(error || holdsError || actionError) && (
        <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>
          {error || holdsError || actionError}
        </p>
      )}
    </div>
  );
};
