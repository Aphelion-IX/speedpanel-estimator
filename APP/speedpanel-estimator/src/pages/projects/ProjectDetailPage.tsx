// =============================================================================
// Project detail
// =============================================================================
// Thin wrapper around a saved project: name/rename, delete, and (once wired
// by the caller) opening it in the normal Estimator tab to actually edit
// walls -- the calculator UI itself is not duplicated here, see wallStore.ts's
// loadFrom/exportSnapshot.
//
// This is "the project journey" view (see ProjectsListPage.tsx's card strip,
// which links here). Structured as a hero card (icon block standing in for a
// real project photo, which this app doesn't have -- name/badge/Ref/rename,
// a real-data stat row, StageStepper, and the two actions that don't belong
// in a feature card below) followed by a 3-column card row (Orders,
// Manufacturing & Delivery, Request Services) and a 2-column card row
// (Activity, Documents) -- mirroring a richer command-centre layout while
// only ever showing real data. Manufacturing & Delivery and Documents are
// explicit "coming soon" placeholders (no fabricated numbers/statuses) since
// this app doesn't track panel counts, per-delivery status, or file uploads
// yet -- StageStepper/ReviewActionPanel already reflect the real
// Draft/Install review/Technical review/Approved pipeline, so they aren't
// swapped for a look-alike stepper implying tracking this app doesn't have.
// A delivery's own status lives on OrderDetailPage.tsx (reached via the
// Orders card), not duplicated onto this page.
// =============================================================================
import { useState } from "react";
import { Building2, Package, Factory, Activity as ActivityIcon, FileText } from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { Card, CardGrid, Stat } from "../../ui/primitives";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProject } from "./projectDetailStore";
import { StageStepper } from "./StageStepper";
import { ReviewActionPanel } from "./ReviewActionPanel";
import { useProjectOrders } from "./orders/ordersStore";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS } from "./orders/orderTypes";
import { STAGES, STAGE_LABELS, PROJECT_STAGE_BADGE_CLASS } from "./projectTypes";
import { useProjectActivity, STAGE_EVENT_LABELS } from "./projectActivityStore";
import type { ProjectRow } from "./projectTypes";

const stageProgress = (stage: ProjectRow["stage"]): number => Math.round(STAGES.indexOf(stage) / (STAGES.length - 1) * 100);

export const ProjectDetailPage = ({ id, onBack, onOpenEstimator, onRequestQuote, onCreateOrder, onOpenOrder, layoutMode }: {
  id: string; onBack: () => void; onOpenEstimator: (project: ProjectRow) => void; onRequestQuote: () => void;
  onCreateOrder: (id: string) => void; onOpenOrder: (id: string, orderId: string) => void;
  layoutMode: EffectiveLayout;
}) => {
  const { orders } = useProjectOrders(id);
  const { events, loading: activityLoading, error: activityError } = useProjectActivity(id);
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
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="grid h-24 w-full shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-950/40 sm:w-24">
              <Building2 size={36} style={{ color: BLUE }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-bold" style={{ color: NAVY }}>{project.name}</h1>
                    <span className={`${cx.badge} ${PROJECT_STAGE_BADGE_CLASS[project.stage]}`}>{STAGE_LABELS[project.stage]}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: MUTED }}>
                    Ref: {project.id.slice(0, 8).toUpperCase()} &middot; Last updated {new Date(project.updated_at).toLocaleString()}
                  </p>
                </div>
                <button onClick={startRename} className="shrink-0 text-sm font-semibold hover:underline" style={{ color: BLUE }}>Rename</button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 max-w-sm">
                <Stat value={`${stageProgress(project.stage)}%`} label="Progress" />
                <Stat value={STAGE_LABELS[project.stage]} label="Current stage" />
                <Stat value={orders.length} label="Orders" />
              </div>
            </div>
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
          <button onClick={handleDelete} disabled={deleting}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-red-500 disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete project"}
          </button>
        </div>
      </div>

      <CardGrid layoutMode={layoutMode} minWidth={280}>
        <Card title="Orders" icon={<Package size={14} />}>
          {orders.length === 0 ? (
            <p className={cx.footnote} style={{ paddingTop: 0 }}>No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.map(o => (
                <button key={o.id} onClick={() => onOpenOrder(project.id, o.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-left text-sm">
                  <span style={{ color: NAVY }}>{new Date(o.created_at).toLocaleDateString()} -- ${o.total_inc_gst.toFixed(2)}</span>
                  <span className={`${cx.badge} ${ORDER_STAGE_BADGE_CLASS[o.stage]}`}>{ORDER_STAGE_LABELS[o.stage]}</span>
                </button>
              ))}
            </div>
          )}
          {/* No stage gate -- an order can be created from a project at any stage. */}
          <button onClick={() => onCreateOrder(project.id)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
            + Create order
          </button>
        </Card>

        <Card title="Manufacturing & Delivery" icon={<Factory size={14} />}>
          <p className={cx.footnote} style={{ paddingTop: 0 }}>
            Coming soon -- live panel counts and delivery status will appear here once your order is in production.
          </p>
        </Card>

        <ReviewActionPanel project={project} onChanged={reload} onRequestQuote={onRequestQuote}
          onRequestInstallReview={requestInstallReview} onRequestTechnicalReview={requestTechnicalReview} />
      </CardGrid>

      <CardGrid layoutMode={layoutMode} minWidth={320}>
        <Card title="Activity" icon={<ActivityIcon size={14} />}>
          {activityLoading ? (
            <p className={cx.footnote} style={{ paddingTop: 0 }}>Loading...</p>
          ) : activityError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{activityError}</p>
          ) : events.length === 0 ? (
            <p className={cx.footnote} style={{ paddingTop: 0 }}>No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map(e => (
                <div key={e.id} className={cx.rowBorder}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{STAGE_EVENT_LABELS[e.event_type]}</span>
                    <span className={cx.footnote} style={{ paddingTop: 0 }}>{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                  {e.note && <p className={cx.footnote}>{e.note}</p>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Documents" icon={<FileText size={14} />}>
          <p className={cx.footnote} style={{ paddingTop: 0 }}>
            Coming soon -- shop drawings, delivery dockets, and other project documents will appear here.
          </p>
        </Card>
      </CardGrid>
    </div>
  );
};
