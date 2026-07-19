
import { Archive, CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState } from "../../ui/states";
import { cx, MUTED } from "../../styleTokens";
import {
  PROJECT_OPERATIONAL_STATUS_BADGE_CLASS,
  PROJECT_OPERATIONAL_STATUS_LABELS,
} from "./projectOperationsTypes";
import {
  useProjectCompletionCheck,
  useProjectOperations,
} from "./projectOperationsStore";

export const ProjectLifecycleCard = ({
  projectId,
  customerView = true,
}: {
  projectId: string;
  customerView?: boolean;
}) => {
  const {
    operations,
    loading,
    error,
    complete,
    archive,
    restore,
  } = useProjectOperations(projectId);
  const {
    check,
    loading: checkLoading,
    error: checkError,
    reload: reloadCheck,
  } = useProjectCompletionCheck(projectId);

  if (loading || checkLoading) {
    return <LoadingState label="Loading project lifecycle" />;
  }

  if (!operations) return null;

  const run = async (
    action: () => Promise<string | null>,
  ) => {
    const actionError = await action();
    if (!actionError) await reloadCheck();
  };

  return (
    <Card
      title="Project Lifecycle"
      icon={<CheckCircle2 size={14} />}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${cx.badge} ${
            PROJECT_OPERATIONAL_STATUS_BADGE_CLASS[operations.status]
          }`}
        >
          {PROJECT_OPERATIONAL_STATUS_LABELS[operations.status]}
        </span>
        {operations.archived_at && (
          <span className={`${cx.badge} bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200`}>
            Archived
          </span>
        )}
      </div>

      {check && check.blockers.length > 0 && (
        <div className="mt-3 space-y-2">
          {check.blockers.map(blocker => (
            <div
              key={blocker}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
            >
              {blocker}
            </div>
          ))}
        </div>
      )}

      <p className={cx.footnote} style={{ color: MUTED }}>
        Installation Review becomes available after the first completed
        delivery. Product Warranty becomes available after project completion.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {!customerView && !operations.completed_at && (
          <Button
            icon={<CheckCircle2 size={14} />}
            disabled={!check?.canComplete}
            onClick={() => run(() => complete(operations.version))}
          >
            Complete Project
          </Button>
        )}
        {operations.completed_at && !operations.archived_at && (
          <Button
            variant="danger"
            icon={<Archive size={14} />}
            onClick={() => run(() => archive(operations.version))}
          >
            Archive Project
          </Button>
        )}
        {operations.archived_at && (
          <Button
            variant="secondary"
            icon={<RotateCcw size={14} />}
            onClick={() => run(() => restore(operations.version))}
          >
            Restore Project
          </Button>
        )}
      </div>

      {(error || checkError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || checkError}
        </p>
      )}
    </Card>
  );
};
