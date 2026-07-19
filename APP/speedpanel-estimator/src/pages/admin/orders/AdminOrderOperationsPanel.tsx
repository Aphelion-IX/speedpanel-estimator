
import { useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import {
  Field,
  SelectField,
  TextAreaField,
} from "../../shared/fields";
import { cx, MUTED } from "../../../styleTokens";
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
    <Card title="Order Operations" icon={<RefreshCcw size={14} />}>
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
        className="grid gap-3 sm:grid-cols-2"
      >
        <SelectField
          label="Update mode"
          value={mode}
          options={[
            {
              value: "progression",
              label: "Normal progression",
            },
            {
              value: "correction",
              label: "Administrative correction",
            },
          ]}
          onChange={value =>
            setMode(value as "progression" | "correction")
          }
        />
        <SelectField
          label="Target status"
          value={
            mode === "progression"
              ? progressionTarget
              : targetStatus
          }
          options={
            mode === "progression"
              ? progressionOptions
              : STATUS_OPTIONS
          }
          onChange={value =>
            setTargetStatus(value as OrderOperationalStatus)
          }
        />
        {mode === "correction" && (
          <div className="sm:col-span-2">
            <Field
              label="Correction reason"
              value={reason}
              onChange={setReason}
              required
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={
              busy ||
              (mode === "progression" &&
                progressionOptions.length === 0) ||
              (mode === "correction" && !reason.trim())
            }
          >
            {busy ? "Saving..." : "Update Status"}
          </Button>
        </div>
      </form>

      <div className={cx.hr} />

      <div className="grid gap-3">
        <SelectField
          label="Customer action"
          value={customerActionRequired ? "required" : "none"}
          options={[
            { value: "none", label: "No action required" },
            { value: "required", label: "Action required" },
          ]}
          onChange={value =>
            setCustomerActionRequired(value === "required")
          }
        />
        <TextAreaField
          label="Customer message"
          value={customerActionNote}
          onChange={setCustomerActionNote}
        />
        <div>
          <Button
            variant="secondary"
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
          </Button>
        </div>
      </div>

      <div className={cx.hr} />

      {check?.blockers.length ? (
        <div className="space-y-2">
          {check.blockers.map(blocker => (
            <div
              key={blocker}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {blocker}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
          All completion checks have passed.
        </p>
      )}

      <div className="mt-3">
        <Button
          disabled={busy || !check?.canComplete}
          onClick={() =>
            run(() => complete(operations.version))
          }
        >
          Complete Order
        </Button>
      </div>

      <p className={cx.footnote} style={{ color: MUTED }}>
        Accepted orders are immutable. Use a linked amendment
        for post-acceptance commercial or quantity changes.
      </p>

      {(error || checkError || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || checkError || actionError}
        </p>
      )}
    </Card>
  );
};
