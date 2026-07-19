
import { useMemo, useState } from "react";
import { CheckCircle2, RefreshCcw } from "lucide-react";
import { cx, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/primitives";
import { Field, SelectField } from "../../shared/fields";
import { useProject } from "../../projects/projectDetailStore";
import {
  PROJECT_OPERATIONAL_STATUSES,
  PROJECT_OPERATIONAL_STATUS_LABELS,
  type ProjectOperationalStatus,
} from "../../projects/projectOperationsTypes";
import {
  useProjectCompletionCheck,
  useProjectOperations,
} from "../../projects/projectOperationsStore";
import { ProjectLifecycleCard } from "../../projects/ProjectLifecycleCard";

const STATUS_OPTIONS = PROJECT_OPERATIONAL_STATUSES.map(value => ({
  value,
  label: PROJECT_OPERATIONAL_STATUS_LABELS[value],
}));

export const AdminProjectOperationsPage = ({
  projectId,
}: {
  projectId: string;
}) => {
  const { project, loading: projectLoading, error: projectError } =
    useProject(projectId);
  const {
    operations,
    loading,
    error,
    progress,
    correct,
  } = useProjectOperations(projectId);
  const { check } = useProjectCompletionCheck(projectId);
  const [toStatus, setToStatus] =
    useState<ProjectOperationalStatus>("planning");
  const [mode, setMode] = useState<"progression" | "correction">(
    "progression",
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nextStatus = useMemo(() => {
    if (!operations) return "planning";
    const index = PROJECT_OPERATIONAL_STATUSES.indexOf(operations.status);
    return PROJECT_OPERATIONAL_STATUSES[index + 1] ?? operations.status;
  }, [operations]);

  if (projectLoading || loading || !project || !operations) {
    return <p className={cx.footnote}>Loading project operations...</p>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    const target = mode === "progression" ? nextStatus : toStatus;
    const saveError =
      mode === "progression"
        ? await progress(target, operations.version)
        : await correct(target, operations.version, reason);
    setSaving(false);
    if (saveError) setActionError(saveError);
  };

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-4">
        <Card
          title={`${project.name} · Operations`}
          icon={<RefreshCcw size={14} />}
        >
          <p className="text-sm" style={{ color: MUTED }}>
            {project.project_number || project.id.slice(0, 8).toUpperCase()}
          </p>

          <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Update mode"
              value={mode}
              options={[
                { value: "progression", label: "Normal progression" },
                { value: "correction", label: "Administrative correction" },
              ]}
              onChange={value =>
                setMode(value as "progression" | "correction")
              }
            />
            <SelectField
              label="Target status"
              value={mode === "progression" ? nextStatus : toStatus}
              options={STATUS_OPTIONS}
              onChange={value =>
                setToStatus(value as ProjectOperationalStatus)
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
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update Status"}
              </Button>
            </div>
          </form>

          {(projectError || error || actionError) && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300">
              {projectError || error || actionError}
            </p>
          )}
        </Card>

        <Card
          title="Completion Checks"
          icon={<CheckCircle2 size={14} />}
        >
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
        </Card>
      </div>

      <div>
        <ProjectLifecycleCard
          projectId={projectId}
          customerView={false}
        />
      </div>
    </div>
  );
};
