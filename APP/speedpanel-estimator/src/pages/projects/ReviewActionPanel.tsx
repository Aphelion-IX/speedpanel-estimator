// =============================================================================
// Review action panel
// =============================================================================
// Customer-facing "request the next review" control. Only ever shows ONE
// action at a time, matching the linear/enforced stage model: request install
// review (from draft, no prior install approval), request technical review
// (from draft, once install review is approved), or a waiting/approved
// message otherwise. Surfaces the latest changes-requested note (if any) so
// the customer knows what to fix before re-requesting. Takes the request
// actions as props (from the caller's own useProject(id) instance) rather
// than creating a second one, so there's a single source of truth for the
// project row.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE } from "../../styleTokens";
import type { ProjectRow } from "./projectTypes";

export const ReviewActionPanel = ({ project, onRequestInstallReview, onRequestTechnicalReview, onChanged }: {
  project: ProjectRow;
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

  const canRequestInstall = project.stage === "draft" && project.install_review_status !== "approved";
  const canRequestTechnical = project.stage === "draft" && project.install_review_status === "approved";

  return (
    <div className={`${cx.card} mt-3`}>
      <h2 className={cx.cardHd} style={{ marginBottom: 0 }}>Reviews</h2>

      {project.install_review_status === "changes_requested" && project.install_review_note && (
        <p className={`mt-2 ${cx.infoNote}`} style={{ marginTop: "0.75rem" }}>{project.install_review_note}</p>
      )}
      {project.technical_review_status === "changes_requested" && project.technical_review_note && (
        <p className={`mt-2 ${cx.infoNote}`} style={{ marginTop: "0.75rem" }}>{project.technical_review_note}</p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {canRequestInstall && (
          <button onClick={() => run(onRequestInstallReview)} disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            Request install review
          </button>
        )}
        {canRequestTechnical && (
          <button onClick={() => run(onRequestTechnicalReview)} disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            Request technical review
          </button>
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
      </div>
    </div>
  );
};
