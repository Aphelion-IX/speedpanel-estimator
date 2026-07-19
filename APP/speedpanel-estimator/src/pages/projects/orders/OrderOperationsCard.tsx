
import { useState } from "react";
import { CheckCircle2, Copy, MessageSquareText } from "lucide-react";
import { Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { TextAreaField } from "../../shared/fields";
import { cx, MUTED } from "../../../styleTokens";
import {
  ORDER_HOLD_TYPE_LABELS,
  ORDER_OPERATIONAL_STATUS_BADGE_CLASS,
  ORDER_OPERATIONAL_STATUS_LABELS,
} from "./orderOperationsTypes";
import { useOrderHolds, useOrderOperations } from "./orderOperationsStore";

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
    <Card title="Order Status" icon={<CheckCircle2 size={14} />}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${cx.badge} ${ORDER_OPERATIONAL_STATUS_BADGE_CLASS[operations.operational_status]}`}>
          {ORDER_OPERATIONAL_STATUS_LABELS[operations.operational_status]}
        </span>
        {operations.customer_action_required && (
          <span className={`${cx.badge} bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300`}>
            Action Required
          </span>
        )}
      </div>

      {operations.customer_action_note && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {operations.customer_action_note}
        </div>
      )}

      {openHolds.length > 0 && (
        <div className="mt-3 space-y-2">
          {openHolds.map(hold => (
            <div key={hold.id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                {hold.title}
              </p>
              <p className="mt-1 text-xs text-red-600 dark:text-red-300">
                {hold.customer_message || "Speedpanel is reviewing this order."}
              </p>
              <p className="mt-1 text-[10px]" style={{ color: MUTED }}>
                {ORDER_HOLD_TYPE_LABELS[hold.hold_type]}
              </p>
            </div>
          ))}
        </div>
      )}

      {requestingChanges ? (
        <div className="mt-3">
          <TextAreaField label="What needs to change?" value={changeNote} onChange={setChangeNote} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
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
            </Button>
            <Button variant="ghost" onClick={() => setRequestingChanges(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {operations.operational_status === "quote_issued" && (
            <>
              <Button
                icon={<CheckCircle2 size={14} />}
                disabled={!canAccept || busy}
                onClick={() => run(() => acceptQuote(operations.version))}
              >
                Accept Quote
              </Button>
              <Button
                variant="secondary"
                icon={<MessageSquareText size={14} />}
                disabled={busy}
                onClick={() => setRequestingChanges(true)}
              >
                Request Changes
              </Button>
            </>
          )}

          {["accepted", "processing", "manufacturing", "ready_for_delivery", "partially_delivered", "completed"].includes(operations.operational_status) && (
            <Button
              variant="secondary"
              icon={<Copy size={14} />}
              disabled={busy}
              onClick={() => createCopy("repeat")}
            >
              Repeat Order
            </Button>
          )}

          {["accepted", "processing", "manufacturing", "ready_for_delivery", "partially_delivered"].includes(operations.operational_status) && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => createCopy("amendment")}
            >
              Create Amendment
            </Button>
          )}
        </div>
      )}

      <p className={cx.footnote} style={{ color: MUTED }}>
        Accepted orders are locked. Later changes create a linked amendment
        instead of altering the accepted order.
      </p>

      {(error || holdsError || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || holdsError || actionError}
        </p>
      )}
    </Card>
  );
};
