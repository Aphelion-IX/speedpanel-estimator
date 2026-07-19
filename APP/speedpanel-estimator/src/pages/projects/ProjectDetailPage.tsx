// =============================================================================
// Project detail -- the expanded per-project view
// =============================================================================
// Replaces ProjectDashboard.tsx (deleted) -- was embedded directly beneath
// ProjectsListPage.tsx's carousel; now its own full view reached at
// #/projects/:id with an explicit back link (see ProjectsRouter.tsx). Modeled
// on the supplied ProjectOverviewPage.tsx mockup: hero, a merged "Project
// Progress" card, What's Next/Quick Order cards, Quick Actions, Orders,
// Recent Activity, Request Services, Documents, Project Team.
//
// Restructured into four project-level tabs (Projects Experience Redesign
// spec section 3/10): Overview / Orders & Deliveries / Support / Documents --
// the header, attention banner and Project Progress card stay above the tabs
// (page furniture every tab shares), everything else moved into its matching
// tab instead of one long scroll (spec section 2: "do not expose everything
// at once").
//
// "Project Progress" shows two independent stage trackers stacked together,
// each still reading its own value -- they're deliberately NOT conflated
// into one number (see journeyStage.ts's header comment for why, a past
// "stage drift" bug):
//  - "Order Progress": the 8-step Estimating..Completed journey stage, a
//    DISPLAY-ONLY value computed here from this project's real orders/
//    manufacturing/delivery data via journeyStage.ts, never persisted.
//  - "Design Review": the real project.stage (draft/install_review/
//    technical_review/approved) via StageStepper.tsx.
// Both trackers render through the same StepTracker.tsx primitive so they
// read as one coherent section instead of two unrelated-looking widgets.
// =============================================================================
import { useMemo, useState } from "react";
import {
  Building2, Activity as ActivityIcon,
  Send, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight,
  CalendarDays, ShoppingCart, FileText, Box, UserRound, ClipboardCheck, Wrench,
  Trash2, Pencil,
} from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field, TextAreaField } from "../shared/fields";
import { Card, WarningsList, Stat, IconButton } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { Table, type TableColumn } from "../../ui/table";
import { ConfirmDialog } from "../../ui/confirmDialog";
import { Tabs, TabPanel } from "../../ui/tabs";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProject } from "./projectDetailStore";
import { useProjectCompanyNames } from "./projectsStore";
import { ReviewActionPanel, canRequestInstallReview, canRequestTechnicalReview } from "./ReviewActionPanel";
import { StageStepper } from "./StageStepper";
import { ProjectJourneyTimeline } from "./ProjectJourneyTimeline";
import { useProjectOrders } from "./orders/ordersStore";
import { useOrderDeliveriesForOrders } from "./orders/orderDeliveriesStore";
import { journeyStageForProject, journeyStageForOrder, journeyProgressPercent, JOURNEY_STAGE_LABELS, JOURNEY_STAGE_BADGE_CLASS } from "./journeyStage";
import { journeyMilestone, nextDeliveryDate } from "./journeyCopy";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS, totalPanelCount, summarizeOrders, type OrderRow } from "./orders/orderTypes";
import {
  useProjectActivity, STAGE_EVENT_LABELS, STAGE_EVENT_DESCRIPTIONS, relativeTime,
  type StageEventType,
} from "./projectActivityStore";
import { ProjectDocumentsCard } from "./documents/ProjectDocumentsCard";
import { ProjectMembersCard } from "./ProjectMembersCard";
import { ProjectSpeedpanelTeamCard } from "./ProjectSpeedpanelTeamCard";
import { ProjectServicesCard } from "./services/ProjectServicesCard";
import { ProjectContactsCard } from "./ProjectContactsCard";
import { ProjectNotificationPreferencesCard } from "./ProjectNotificationPreferencesCard";
import { ProjectLifecycleCard } from "./ProjectLifecycleCard";
import type { ProjectRow } from "./projectTypes";

const EVENT_ICON: Record<StageEventType, { Icon: typeof Send; className: string }> = {
  install_review_requested: { Icon: Send, className: "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" },
  technical_review_requested: { Icon: Send, className: "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" },
  install_review_approved: { Icon: CheckCircle2, className: "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300" },
  technical_review_approved: { Icon: CheckCircle2, className: "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300" },
  install_review_changes_requested: { Icon: AlertCircle, className: "bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300" },
  technical_review_changes_requested: { Icon: AlertCircle, className: "bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300" },
};

const QuickAction = ({ icon: Icon, label, onClick, disabled, tone = "blue" }: {
  icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean;
  tone?: "blue" | "green" | "purple" | "orange" | "cyan";
}) => {
  const tones: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-300", green: "text-emerald-600 dark:text-emerald-300",
    purple: "text-violet-600 dark:text-violet-400", orange: "text-orange-500 dark:text-orange-400",
    cyan: "text-cyan-600 dark:text-cyan-300",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md disabled:opacity-40 disabled:hover:translate-y-0">
      <Icon className={`h-6 w-6 shrink-0 ${tones[tone]}`} />
      <span className="text-sm font-semibold" style={{ color: NAVY }}>{label}</span>
    </button>
  );
};

const PROJECT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders & Deliveries" },
  { id: "support", label: "Support" },
  { id: "documents", label: "Documents" },
  { id: "people", label: "Members & Contacts" },
  { id: "settings", label: "Settings" },
];

export const ProjectDetailPage = ({ id, userId, onBack, onOpenEstimator, onCreateOrder, onCreateQuickOrder, onOpenOrder, layoutMode }: {
  id: string; userId: string | null; onBack: () => void; onOpenEstimator: (project: ProjectRow) => void;
  onCreateOrder: (id: string) => void; onCreateQuickOrder: (id: string) => void; onOpenOrder: (id: string, orderId: string) => void;
  layoutMode: EffectiveLayout;
}) => {
  const { orders } = useProjectOrders(id);
  const nonCancelledOrders = useMemo(() => orders.filter(o => o.stage !== "cancelled"), [orders]);
  const orderIds = useMemo(() => nonCancelledOrders.map(o => o.id), [nonCancelledOrders]);
  const { deliveriesByOrder } = useOrderDeliveriesForOrders(orderIds);
  const { events, loading: activityLoading, error: activityError } = useProjectActivity(id);
  const { project, loading, error, reload, rename, saveSnapshot, deleteProject, requestInstallReview, requestTechnicalReview } = useProject(id);
  const companyNames = useProjectCompanyNames(useMemo(() => (project?.company_id ? [project.company_id] : []), [project?.company_id]));
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quickActionBusy, setQuickActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const journey = useMemo(() => {
    if (!project) return null;
    return journeyStageForProject(project, nonCancelledOrders.map(order => ({ order, deliveries: deliveriesByOrder.get(order.id) ?? [] })));
  }, [project, nonCancelledOrders, deliveriesByOrder]);

  // "At a glance" summary data -- scoped to this project's own already-
  // fetched orders/deliveries, no new fetch. allDeliveries doesn't need
  // re-filtering for cancelled orders -- orderIds (above) already excluded
  // them before deliveriesByOrder was built.
  const allDeliveries = useMemo(() => [...deliveriesByOrder.values()].flat(), [deliveriesByOrder]);

  const representativeOrder = orders.find(o => o.id === journey?.representativeOrderId);
  const representativeDeliveries = representativeOrder ? (deliveriesByOrder.get(representativeOrder.id) ?? []) : [];

  const orderColumns: TableColumn<OrderRow>[] = useMemo(() => [
    {
      key: "order", header: "Order",
      cell: o => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold" style={{ color: NAVY }}>Order {o.id.slice(0, 8).toUpperCase()}</span>
            <span className={`${cx.badge} ${ORDER_STAGE_BADGE_CLASS[o.stage]}`}>{ORDER_STAGE_LABELS[o.stage]}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>{totalPanelCount(o.line_items)} panels &middot; ${o.total_inc_gst.toFixed(2)}</p>
        </div>
      ),
    },
    {
      key: "progress", header: "Progress",
      cell: o => {
        const orderStage = journeyStageForOrder(o, deliveriesByOrder.get(o.id) ?? []);
        const progress = o.stage === "cancelled" ? 0 : journeyProgressPercent(orderStage, o);
        return (
          <div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: BLUE }} />
              </div>
              <span className="text-sm font-bold" style={{ color: NAVY }}>{progress}%</span>
            </div>
            <p className="mt-2 text-xs" style={{ color: MUTED }}>{new Date(o.created_at).toLocaleDateString()}</p>
          </div>
        );
      },
    },
    {
      key: "chevron", header: "", align: "right", className: "w-10",
      cell: () => <ChevronRight className="ml-auto h-5 w-5" style={{ color: MUTED }} />,
    },
  ], [deliveriesByOrder]);

  if (loading) return <LoadingState className="mt-5" label="Loading project" />;

  if (error || !project || !journey) {
    return (
      <div className="mt-5">
        <ErrorState message={error || "Project not found."} onRetry={() => reload()} />
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>All projects</button>
      </div>
    );
  }

  const startRename = () => {
    setName(project.name);
    setReference(project.data.reference ?? "");
    setSiteAddress(project.data.siteAddress ?? "");
    setCustomerName(project.data.customerName ?? "");
    setDescription(project.data.description ?? "");
    setEditingName(true);
  };
  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setRenaming(true);
    setActionError(null);
    const renameErr = await rename(name.trim() || project.name);
    if (renameErr) { setRenaming(false); setActionError(renameErr); return; }
    const snapshotErr = await saveSnapshot({ ...project.data, reference, siteAddress, customerName, description });
    setRenaming(false);
    if (snapshotErr) { setActionError(snapshotErr); return; }
    setEditingName(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const err = await deleteProject();
    setDeleting(false);
    if (err) setActionError(err);
  };

  const runQuickAction = async (action: () => Promise<string | null>) => {
    setQuickActionBusy(true);
    setActionError(null);
    const err = await action();
    setQuickActionBusy(false);
    if (err) setActionError(err);
  };

  const companyName = project.company_id ? companyNames.get(project.company_id) : undefined;
  const milestone = journeyMilestone(journey.stage, {
    estimatingNote: journey.estimatingNote,
    estCompletion: representativeOrder?.manufacturing_est_completion,
    nextDeliveryDate: nextDeliveryDate(representativeDeliveries),
  });

  const summary = summarizeOrders(orders);
  const nextDelivery = nextDeliveryDate(allDeliveries);
  const summaryWarnings: string[] = [];
  if (summary.unpricedCount > 0) {
    summaryWarnings.push(`${summary.unpricedCount} item${summary.unpricedCount !== 1 ? "s" : ""} across your orders couldn't be priced automatically.`);
  }
  if (project.install_review_status === "changes_requested") {
    summaryWarnings.push("Install review needs changes — see the Support tab below.");
  }
  if (project.technical_review_status === "changes_requested") {
    summaryWarnings.push("Technical review needs changes — see the Support tab below.");
  }

  return (
    <div className="mt-2">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
        <ChevronLeft className="h-4 w-4" />All projects
      </button>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title={`Delete "${project.name}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
      />

      <div className={`${cx.card} mt-3`}>
        {editingName ? (
          <form onSubmit={submitRename} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project name" value={name} onChange={setName} required />
              <Field label="Project reference" value={reference} onChange={setReference} />
              <Field label="Site address" value={siteAddress} onChange={setSiteAddress} />
              <Field label="Customer or company" value={customerName} onChange={setCustomerName} />
              <div className="sm:col-span-2"><TextAreaField label="Description" value={description} onChange={setDescription} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={renaming} className="h-[46px] shrink-0">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEditingName(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="grid h-24 w-full shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-900/55 sm:w-24">
              <Building2 size={36} style={{ color: BLUE }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className={cx.h1}>{project.name}</h1>
                  <p className="mt-1 text-xs" style={{ color: MUTED }}>
                    {project.project_number || project.id.slice(0, 8).toUpperCase()}
                    {project.data.reference ? ` · Ref: ${project.data.reference}` : ""}
                    {companyName ? ` · ${companyName}` : ""}
                  </p>
                  {(project.data.siteAddress || project.data.customerName || project.builder_name) && (
                    <p className="mt-1 text-xs" style={{ color: MUTED }}>
                      {project.data.siteAddress}
                      {project.builder_name && <> &middot; Builder: {project.builder_name}</>}
                      {project.data.customerName && <> &middot; {project.data.customerName}</>}
                    </p>
                  )}
                  {project.data.description && (
                    <p className="mt-1 max-w-prose text-xs" style={{ color: MUTED }}>{project.data.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`${cx.badge} ${JOURNEY_STAGE_BADGE_CLASS[journey.stage]}`}>{JOURNEY_STAGE_LABELS[journey.stage]}</span>
                    {representativeOrder?.manufacturing_est_completion && (
                      <span style={{ color: MUTED }}>Expected completion: {new Date(representativeOrder.manufacturing_est_completion).toLocaleDateString()}</span>
                    )}
                    <span style={{ color: MUTED }}>Last updated: {relativeTime(project.updated_at)}</span>
                  </div>
                </div>
                <IconButton onClick={startRename} title="Edit details" ariaLabel="Edit project details"><Pencil size={15} /></IconButton>
              </div>
            </div>
          </div>
        )}

        {actionError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{actionError}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => onOpenEstimator(project)}>Open in Estimator</Button>
          <Button variant="secondary" icon={<ShoppingCart size={15} />} onClick={() => onCreateQuickOrder(project.id)}>Quick Order</Button>
          <Button variant="secondary" icon={<FileText size={15} />} onClick={() => setActiveTab("documents")}>My Documents</Button>
          <Button variant="danger" icon={<Trash2 size={15} />} disabled={deleting} onClick={() => setConfirmDelete(true)}>
            {deleting ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </div>

      <WarningsList warnings={summaryWarnings} />

      <Tabs tabs={PROJECT_TABS} activeId={activeTab} onChange={setActiveTab} />

      <TabPanel id="overview" activeId={activeTab}>
        <Card title="Project Progress" icon={<Wrench size={14} />}>
          <div className={cx.sectionLbl}>Order Progress</div>
          <ProjectJourneyTimeline stage={journey.stage} layoutMode={layoutMode} />
          <div className={cx.hr} />
          <div className={cx.sectionLbl}>Design Review</div>
          <StageStepper stage={project.stage} layoutMode={layoutMode} />
        </Card>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat value={summary.count} label="Orders" />
          <Stat value={`$${summary.totalValue.toFixed(0)}`} label="Total value" />
          <Stat value={nextDelivery ? new Date(nextDelivery).toLocaleDateString() : "—"} label="Next delivery" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
          <section className="flex min-h-32 items-center justify-between overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="flex items-start gap-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: BLUE, color: WHITE }}>
                <CalendarDays className="h-6 w-6" />
              </span>
              <div>
                <h2 className={cx.h3}>What&apos;s Next?</h2>
                <p className="mt-1 font-semibold" style={{ color: NAVY }}>{milestone.label}</p>
                <p className="mt-2 text-sm" style={{ color: MUTED }}>{milestone.note}</p>
              </div>
            </div>
            <Building2 className="hidden h-20 w-20 text-blue-100 dark:text-blue-950 sm:block" />
          </section>

          <section className="flex items-center gap-5 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-600 text-white">
              <ShoppingCart className="h-6 w-6" />
            </span>
            <div>
              <h2 className={cx.h3}>Quick Order</h2>
              <p className="mt-1 text-sm" style={{ color: MUTED }}>Place an order without using the Estimator.</p>
              <button onClick={() => onCreateQuickOrder(project.id)} className="mt-3 rounded-lg border border-violet-300 dark:border-violet-700 px-5 py-2 text-sm font-semibold text-violet-700 dark:text-violet-400">
                Start Quick Order &rarr;
              </button>
            </div>
          </section>
        </div>

        <section className={`${cx.card} mt-4`}>
          <h2 className={cx.h3}>Quick Actions</h2>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Create Order uses your saved Estimator design. Need to order without one? Use Quick Order above.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction icon={FileText} label="Open Estimate" onClick={() => onOpenEstimator(project)} />
            <QuickAction icon={Box} label="Create Order" tone="green" onClick={() => onCreateOrder(project.id)} />
            <QuickAction icon={UserRound} label="Request Install Review" tone="orange"
              disabled={!canRequestInstallReview(project) || quickActionBusy}
              onClick={() => runQuickAction(requestInstallReview)} />
            <QuickAction icon={ClipboardCheck} label="Request Technical Consult" tone="cyan"
              disabled={!canRequestTechnicalReview(project) || quickActionBusy}
              onClick={() => runQuickAction(requestTechnicalReview)} />
          </div>
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <Card title="Recent Activity" icon={<ActivityIcon size={14} />}>
            {activityLoading ? (
              <LoadingState label="Loading activity" />
            ) : activityError ? (
              <p className="text-sm text-red-600 dark:text-red-300">{activityError}</p>
            ) : events.length === 0 ? (
              <p className={cx.footnote} style={{ paddingTop: 0 }}>No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {events.map(e => {
                  const { Icon, className } = EVENT_ICON[e.event_type];
                  return (
                    <div key={e.id} className={`flex gap-3 ${cx.rowBorder}`}>
                      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${className}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold" style={{ color: NAVY }}>{STAGE_EVENT_LABELS[e.event_type]}</span>
                          <span className={cx.footnote} style={{ paddingTop: 0 }}>{relativeTime(e.created_at)}</span>
                        </div>
                        <p className={cx.footnote}>{e.note || STAGE_EVENT_DESCRIPTIONS[e.event_type]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {project.company_id && (
            <div className="space-y-4">
              <ProjectMembersCard projectId={project.id} companyId={project.company_id} />
              <ProjectSpeedpanelTeamCard companyId={project.company_id} />
            </div>
          )}
        </div>
      </TabPanel>

      <TabPanel id="orders" activeId={activeTab}>
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className={cx.h3}>Orders</h2>
            <Button variant="secondary" onClick={() => onCreateOrder(project.id)}>+ Create New Order</Button>
          </div>
          {orders.length === 0 ? (
            <EmptyState className="mt-3" message="No orders yet." />
          ) : (
            <Table className="mt-3" columns={orderColumns} rows={orders} rowKey={o => o.id} onRowClick={o => onOpenOrder(project.id, o.id)} />
          )}
          <p className="mt-3 text-xs" style={{ color: MUTED }}>Open an order to see its own split deliveries, requested/confirmed dates and delivery status.</p>
        </div>
      </TabPanel>

      <TabPanel id="support" activeId={activeTab}>
        <ReviewActionPanel project={project} onChanged={reload} onCreateOrder={() => onCreateOrder(project.id)}
          onRequestInstallReview={requestInstallReview} onRequestTechnicalReview={requestTechnicalReview} />
        <div className="mt-4">
          <ProjectServicesCard projectId={project.id} userId={userId} layoutMode={layoutMode} />
        </div>
      </TabPanel>

      <TabPanel id="documents" activeId={activeTab}>
        <ProjectDocumentsCard projectId={project.id} userId={userId} />
      </TabPanel>

      <TabPanel id="people" activeId={activeTab}>
        <div className="grid gap-4 xl:grid-cols-2">
          {project.company_id && (
            <ProjectMembersCard projectId={project.id} companyId={project.company_id} />
          )}
          <ProjectContactsCard projectId={project.id} />
        </div>
      </TabPanel>

      <TabPanel id="settings" activeId={activeTab}>
        <div className="grid gap-4 xl:grid-cols-2">
          <ProjectLifecycleCard projectId={project.id} />
          <ProjectNotificationPreferencesCard projectId={project.id} userId={userId} />
        </div>
      </TabPanel>
    </div>
  );
};
