// =============================================================================
// Review action panel -- "Request Services" card
// =============================================================================
// Customer-facing request actions for a project, all in one card: "Request a
// quote" (always available -- see onRequestQuote) plus the linear/enforced
// review model's ONE next action at a time: request install review (from
// draft, no prior install approval), request technical review (from draft,
// once install review is approved), or a waiting/approved message otherwise.
// Surfaces the latest changes-requested note (if any) so the customer knows
// what to fix before re-requesting. Takes the request actions as props (from
// the caller's own useProject(id) instance) rather than creating a second
// one, so there's a single source of truth for the project row.
//
// Icon+label+chevron row style (not solid buttons) matches every other
// "request a service" row on ProjectDashboard.tsx's card grid.
// =============================================================================
import { useState } from "react";
import { ChevronRight, ClipboardCheck, ClipboardList, FileText, Wrench } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { Card } from "../../ui/primitives";
import type { ProjectRow } from "./projectTypes";

const ServiceRow = ({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled}
    className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-left text-sm font-semibold disabled:opacity-50"
    style={{ color: NAVY }}>
    <span className="flex items-center gap-2">
      <span style={{ color: BLUE }}>{icon}</span>{label}
    </span>
    <ChevronRight size={15} className="shrink-0" style={{ color: MUTED }} />
  </button>
);

// Exported so ProjectDetailPage.tsx's Quick Actions grid can gate its own
// "Request Install Review"/"Request Technical Consult" tiles identically --
// a single source of truth for when these actions are actually available,
// rather than a second copy of the same condition drifting out of sync.
export const canRequestInstallReview = (project: Pick<ProjectRow, "stage" | "install_review_status">): boolean =>
  project.stage === "draft" && project.install_review_status !== "approved";
export const canRequestTechnicalReview = (project: Pick<ProjectRow, "stage" | "install_review_status">): boolean =>
  project.stage === "draft" && project.install_review_status === "approved";

export const ReviewActionPanel = ({ project, onRequestQuote, onRequestInstallReview, onRequestTechnicalReview, onChanged }: {
  project: ProjectRow;
  onRequestQuote: () => void;
  onRequestInstallReview: () => Promise<string | null>;
  onRequestTechnicalReview: () => Promise<string | null>;
  onChanged: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setSubmitting(true);
    setError(null);
    const err = await action();
    setSubmitting(false);
    if (err) setError(err);
    else onChanged();
  };

  const canRequestInstall = canRequestInstallReview(project);
  const canRequestTechnical = canRequestTechnicalReview(project);

  return (
    <Card title="Request Services" icon={<Wrench size={14} />}>
      {project.install_review_status === "changes_requested" && project.install_review_note && (
        <p className={cx.infoNote} style={{ marginTop: 0 }}>{project.install_review_note}</p>
      )}
      {project.technical_review_status === "changes_requested" && project.technical_review_note && (
        <p className={cx.infoNote} style={{ marginTop: 0 }}>{project.technical_review_note}</p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ServiceRow label="Request a quote" icon={<FileText size={15} />} onClick={onRequestQuote} />
      {canRequestInstall && (
        <ServiceRow label="Request install review" icon={<ClipboardCheck size={15} />} onClick={() => run(onRequestInstallReview)} disabled={submitting} />
      )}
      {canRequestTechnical && (
        <ServiceRow label="Request technical review" icon={<ClipboardList size={15} />} onClick={() => run(onRequestTechnicalReview)} disabled={submitting} />
      )}
      {project.stage === "install_review" && (
        <p className="text-sm" style={{ color: NAVY }}>Install review requested -- waiting on Speedpanel.</p>
      )}
      {project.stage === "technical_review" && (
        <p className="text-sm" style={{ color: NAVY }}>Technical review requested -- waiting on Speedpanel.</p>
      )}
      {project.stage === "approved" && (
        <p className="text-sm font-semibold" style={{ color: BLUE }}>Project approved.</p>
      )}
    </Card>
  );
};
