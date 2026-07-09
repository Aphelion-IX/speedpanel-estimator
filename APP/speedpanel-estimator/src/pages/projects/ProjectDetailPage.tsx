// =============================================================================
// Project detail
// =============================================================================
// Thin wrapper around a saved project: name/rename, delete, and (once wired
// by the caller) opening it in the normal Estimator tab to actually edit
// walls -- the calculator UI itself is not duplicated here, see wallStore.ts's
// loadFrom/exportSnapshot. Stage stepper and review actions are layered on by
// ReviewActionPanel/StageStepper (added alongside the stage-tracker work).
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { saveProjectLocally } from "../../wallStore";
import { useProject } from "./projectDetailStore";
import { StageStepper } from "./StageStepper";
import { ReviewActionPanel } from "./ReviewActionPanel";
import { useProjectOrders } from "./orders/ordersStore";
import { ORDER_STAGE_LABELS } from "./orders/orderTypes";
import type { ProjectRow } from "./projectTypes";

export const ProjectDetailPage = ({ id, onBack, onOpenEstimator, onRequestQuote, onCreateOrder, onOpenOrder }: {
  id: string; onBack: () => void; onOpenEstimator: (project: ProjectRow) => void; onRequestQuote: (id: string) => void;
  onCreateOrder: (id: string) => void; onOpenOrder: (id: string, orderId: string) => void;
}) => {
  const { orders } = useProjectOrders(id);
  const { project, loading, error, reload, rename, deleteProject, requestInstallReview, requestTechnicalReview } = useProject(id);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error || !project) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Project not found."}</p>
        <button onClick={() => reload()} className="mt-2 mr-4 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back to projects</button>
      </div>
    );
  }

  const startRename = () => { setName(project.name); setEditingName(true); };
  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenaming(true);
    setActionError(null);
    const err = await rename(name.trim() || project.name);
    setRenaming(false);
    if (err) { setActionError(err); return; }
    setEditingName(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${project.name}"? This can't be undone.`)) return;
    setDeleting(true);
    const err = await deleteProject();
    setDeleting(false);
    if (err) { setActionError(err); return; }
    onBack();
  };

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to projects</button>

      <div className={`${cx.card} mt-3`}>
        {editingName ? (
          <form onSubmit={submitRename} className="flex items-end gap-2">
            <div className="flex-1"><Field label="Project name" value={name} onChange={setName} required /></div>
            <button type="submit" disabled={renaming} className="h-[46px] shrink-0 rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              Save
            </button>
            <button type="button" onClick={() => setEditingName(false)} className="h-[46px] shrink-0 rounded-xl px-3 text-sm font-semibold" style={{ color: MUTED }}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold" style={{ color: NAVY }}>{project.name}</h1>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>Last updated {new Date(project.updated_at).toLocaleString()}</p>
            </div>
            <button onClick={startRename} className="shrink-0 text-sm font-semibold hover:underline" style={{ color: BLUE }}>Rename</button>
          </div>
        )}

        <div className="mt-4">
          <StageStepper stage={project.stage} />
        </div>

        {actionError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{actionError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onOpenEstimator(project)}
            className="rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
            Open in Estimator
          </button>
          <button onClick={() => { saveProjectLocally(project.data); onRequestQuote(project.id); }}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
            Request a quote
          </button>
          {/* No stage gate -- an order can be created from a project at any stage. */}
          <button onClick={() => onCreateOrder(project.id)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
            Create order
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-500 disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </div>

      {orders.length > 0 && (
        <div className={`${cx.card} mt-3`}>
          <div className={cx.cardHd}>Orders</div>
          <div className="space-y-2">
            {orders.map(o => (
              <button key={o.id} onClick={() => onOpenOrder(project.id, o.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left text-sm">
                <span style={{ color: NAVY }}>{new Date(o.created_at).toLocaleDateString()} -- ${o.total_inc_gst.toFixed(2)}</span>
                <span className={cx.footnote}>{ORDER_STAGE_LABELS[o.stage]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ReviewActionPanel project={project} onChanged={reload}
        onRequestInstallReview={requestInstallReview} onRequestTechnicalReview={requestTechnicalReview} />
    </div>
  );
};
