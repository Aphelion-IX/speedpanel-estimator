// =============================================================================
// Admin > Project Reviews -- install/technical review queue
// =============================================================================
// One row per project currently awaiting a review action (see
// adminProjectsStore.ts's narrower "stage in (...)" query -- this is a queue,
// not a full project browser). Each row shows the stage stepper, an optional
// note field (required for "Request changes"), and the two decision buttons
// for whichever review is currently pending. The saved wall/system snapshot
// is shown as raw JSON in a collapsible section, same treatment
// AdminRequestsPage.tsx gives requests.project_snapshot -- a full read-only
// render of the calculator UI against someone else's project is a much
// bigger lift, left as a future improvement if this proves insufficient.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { AccordionCard } from "../../../ui/primitives";
import { TextAreaField } from "../../shared/fields";
import { StageStepper } from "../../projects/StageStepper";
import { useAdminProjects } from "./adminProjectsStore";
import type { ProjectRow } from "../../projects/projectTypes";

const ProjectReviewRow = ({ item, onApproveInstall, onChangesInstall, onApproveTechnical, onChangesTechnical }: {
  item: ProjectRow;
  onApproveInstall: (id: string) => Promise<string | null>;
  onChangesInstall: (id: string, note: string) => Promise<string | null>;
  onApproveTechnical: (id: string) => Promise<string | null>;
  onChangesTechnical: (id: string, note: string) => Promise<string | null>;
}) => {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setSubmitting(true);
    setError(null);
    const err = await action();
    setSubmitting(false);
    if (err) setError(err);
    else setNote("");
  };

  const isInstall = item.stage === "install_review";

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
        <div className={cx.footnote}>{new Date(item.updated_at).toLocaleString()}</div>
      </div>

      <div className="mt-3"><StageStepper stage={item.stage} /></div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3">
        <TextAreaField label="Note (required to request changes)" value={note} onChange={setNote} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isInstall ? (
          <>
            <button onClick={() => run(() => onApproveInstall(item.id))} disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Approve install review
            </button>
            <button onClick={() => run(() => onChangesInstall(item.id, note))} disabled={submitting || !note.trim()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Request changes
            </button>
          </>
        ) : (
          <>
            <button onClick={() => run(() => onApproveTechnical(item.id))} disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Approve technical review
            </button>
            <button onClick={() => run(() => onChangesTechnical(item.id, note))} disabled={submitting || !note.trim()}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Request changes
            </button>
          </>
        )}
      </div>

      <div className="mt-3">
        <AccordionCard summary="Project data">
          <pre className="overflow-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs">
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </AccordionCard>
      </div>
    </div>
  );
};

export const AdminProjectsPage = () => {
  const { projects, loading, error, reload, approveInstallReview, requestInstallChanges, approveTechnicalReview, requestTechnicalChanges } = useAdminProjects();

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No projects awaiting review.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {projects.map(item => (
        <ProjectReviewRow key={item.id} item={item}
          onApproveInstall={approveInstallReview} onChangesInstall={requestInstallChanges}
          onApproveTechnical={approveTechnicalReview} onChangesTechnical={requestTechnicalChanges} />
      ))}
    </div>
  );
};
