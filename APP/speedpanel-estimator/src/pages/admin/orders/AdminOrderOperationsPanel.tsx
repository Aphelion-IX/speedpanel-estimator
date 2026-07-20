
import { useMemo, useState } from "react";
import {
  ORDER_ALLOWED_TRANSITIONS,
  ORDER_OPERATIONAL_STATUSES,
  ORDER_OPERATIONAL_STATUS_LABELS,
  type OrderOperationalStatus,
} from "../../projects/orders/orderOperationsTypes";
import {
  useOrderCompletionCheck,
  useOrderOperations,
} from "../../projects/orders/orderOperationsStore";

const STATUS_OPTIONS = ORDER_OPERATIONAL_STATUSES.map(value => ({
  value,
  label: ORDER_OPERATIONAL_STATUS_LABELS[value],
}));

export const AdminOrderOperationsPanel = ({
  orderId,
}: {
  orderId: string;
}) => {
  const {
    operations,
    loading,
    error,
    progress,
    correct,
    setCustomerAction,
    complete,
  } = useOrderOperations(orderId);
  const {
    check,
    loading: checkLoading,
    error: checkError,
    reload: reloadCheck,
  } = useOrderCompletionCheck(orderId);
  const [mode, setMode] =
    useState<"progression" | "correction">("progression");
  const [targetStatus, setTargetStatus] =
    useState<OrderOperationalStatus>("under_review");
  const [reason, setReason] = useState("");
  const [customerActionRequired, setCustomerActionRequired] =
    useState(false);
  const [customerActionNote, setCustomerActionNote] =
    useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] =
    useState<string | null>(null);

  const progressionOptions = useMemo(() => {
    if (!operations) return [];
    return ORDER_ALLOWED_TRANSITIONS[
      operations.operational_status
    ]
      .filter(status =>
        !["accepted", "completed", "cancelled"].includes(status),
      )
      .map(value => ({
        value,
        label: ORDER_OPERATIONAL_STATUS_LABELS[value],
      }));
  }, [operations]);

  const progressionTarget =
    progressionOptions[0]?.value ??
    operations?.operational_status ??
    "under_review";

  if (loading || checkLoading || !operations) return null;

  const run = async (
    action: () => Promise<string | null>,
  ) => {
    setBusy(true);
    setActionError(null);
    const result = await action();
    setBusy(false);
    if (result) setActionError(result);
    else await reloadCheck();
  };

  return (
    <div className="ord-section">
      <div className="ord-section-head"><div><h2>Order Operations</h2></div></div>

      <h3 style={{ marginBottom: 8 }}>Update Status</h3>
      <form
        onSubmit={event => {
          event.preventDefault();
          const target =
            mode === "progression"
              ? progressionTarget
              : targetStatus;
          run(() =>
            mode === "progression"
              ? progress(target, operations.version)
              : correct(
                  target,
                  operations.version,
                  reason.trim(),
                ),
          );
        }}
        className="ord-fieldgrid"
      >
        <div className="ord-field">
          <label>Update mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as "progression" | "correction")}>
            <option value="progression">Normal progression</option>
            <option value="correction">Administrative correction</option>
          </select>
        </div>
        <div className="ord-field">
          <label>Target status</label>
          <select
            value={mode === "progression" ? progressionTarget : targetStatus}
            onChange={e => setTargetStatus(e.target.value as OrderOperationalStatus)}
          >
            {(mode === "progression" ? progressionOptions : STATUS_OPTIONS).map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {mode === "correction" && (
          <div className="ord-field full">
            <label>Correction reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} required />
          </div>
        )}
        <div className="ord-field full">
          <button
            className="ord-btn primary"
            type="submit"
            disabled={
              busy ||
              (mode === "progression" &&
                progressionOptions.length === 0) ||
              (mode === "correction" && !reason.trim())
            }
          >
            {busy ? "Saving..." : "Update Status"}
          </button>
        </div>
      </form>

      <h3 className="mt-4" style={{ marginBottom: 8 }}>Customer Action</h3>
      <div className="ord-fieldgrid">
        <div className="ord-field">
          <label>Customer action</label>
          <select
            value={customerActionRequired ? "required" : "none"}
            onChange={e => setCustomerActionRequired(e.target.value === "required")}
          >
            <option value="none">No action required</option>
            <option value="required">Action required</option>
          </select>
        </div>
        <div className="ord-field full">
          <label>Customer message</label>
          <textarea value={customerActionNote} onChange={e => setCustomerActionNote(e.target.value)} />
        </div>
        <div className="ord-field full">
          <button
            className="ord-btn secondary"
            disabled={busy}
            onClick={() =>
              run(() =>
                setCustomerAction(
                  customerActionRequired,
                  customerActionNote.trim() || null,
                  operations.version,
                ),
              )
            }
          >
            Save Customer Action
          </button>
        </div>
      </div>

      <h3 className="mt-4" style={{ marginBottom: 8 }}>Completion Checks</h3>
      {check?.blockers.length ? (
        <div className="ord-note-list">
          {check.blockers.map(blocker => (
            <div key={blocker} className="ord-note-item" style={{ borderColor: "var(--ord-red)", color: "var(--ord-red)" }}>
              {blocker}
            </div>
          ))}
        </div>
      ) : (
        <p className="ord-small" style={{ color: "var(--ord-green)", fontWeight: 850 }}>
          All completion checks have passed.
        </p>
      )}

      <div className="mt-3">
        <button
          className="ord-btn primary"
          disabled={busy || !check?.canComplete}
          onClick={() =>
            run(() => complete(operations.version))
          }
        >
          Complete Order
        </button>
      </div>

      <p className="ord-tiny ord-muted mt-2">
        Accepted orders are immutable. Use a linked amendment
        for post-acceptance commercial or quantity changes.
      </p>

      {(error || checkError || actionError) && (
        <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>
          {error || checkError || actionError}
        </p>
      )}
    </div>
  );
};
