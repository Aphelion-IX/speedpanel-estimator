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
//
// For a project_manager viewer, an extra "My active projects" section below
// the review queue shows the broader pipeline (every non-approved project
// for their companies, not just what's awaiting a decision) -- relocated
// from the now-deleted My Assignments page, since the review queue itself
// is scoped to their companies too now (see adminProjectsStore.ts).
// =============================================================================
import { useState } from "react";
import { cx, NAVY } from "../../../styleTokens";
import { AccordionCard } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { TextAreaField } from "../../shared/fields";
import { StageStepper } from "../../projects/StageStepper";
import { useAdminProjects, useMyPmProjects } from "./adminProjectsStore";
import { STAGE_LABELS, PROJECT_STAGE_BADGE_CLASS, type ProjectRow } from "../../projects/projectTypes";
import type { InternalRole } from "../../company/staffTypes";

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

      <div className="mt-3"><StageStepper stage={item.stage} layoutMode="web" /></div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3">
        <TextAreaField label="Note (required to request changes)" value={note} onChange={setNote} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isInstall ? (
          <>
            <Button onClick={() => run(() => onApproveInstall(item.id))} disabled={submitting}>Approve install review</Button>
            <Button variant="secondary" onClick={() => run(() => onChangesInstall(item.id, note))} disabled={submitting || !note.trim()}>Request changes</Button>
          </>
        ) : (
          <>
            <Button onClick={() => run(() => onApproveTechnical(item.id))} disabled={submitting}>Approve technical review</Button>
            <Button variant="secondary" onClick={() => run(() => onChangesTechnical(item.id, note))} disabled={submitting || !note.trim()}>Request changes</Button>
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

const MyActiveProjectsSection = ({ companyIds }: { companyIds: string[] }) => {
  const { projects, loading } = useMyPmProjects(companyIds);
  if (loading || projects.length === 0) return null;
  return (
    <div className="mt-6">
      <div className={cx.cardHd}>My active projects ({projects.length})</div>
      <div className="mt-2 space-y-2">
        {projects.map(p => (
          <div key={p.id} className={`${cx.card} flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-sm font-semibold" style={{ color: NAVY }}>{p.name}</span>
            <span className={`${cx.badge} ${PROJECT_STAGE_BADGE_CLASS[p.stage]}`}>{STAGE_LABELS[p.stage]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminProjectsPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { projects, scope, loading, error, reload, approveInstallReview, requestInstallChanges, approveTechnicalReview, requestTechnicalChanges } = useAdminProjects(userId, staffRole, staffRoleLoading);
  const myProjectsSection = staffRole === "project_manager"
    ? <MyActiveProjectsSection companyIds={scope.kind === "companies" ? scope.companyIds : []} />
    : null;

  if (loading) return <LoadingState className="mt-6" label="Loading project reviews" />;

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  if (projects.length === 0) {
    return (
      <div className="mt-2">
        <EmptyState className={`${cx.card} mt-4 text-center`} message="No projects awaiting review." />
        {myProjectsSection}
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
      {myProjectsSection}
    </div>
  );
};
