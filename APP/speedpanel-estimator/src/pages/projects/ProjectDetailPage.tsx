// =============================================================================
// Project detail -- the expanded per-project view
// =============================================================================
// Restyled to match UI-DESIGNS/customer/{desktop,ipad,phone}/
// customer-orders-overview.html's "Open Project" pages exactly -- see
// projectsTheme.css for the scoped `.pj-*` palette/shape this page (and
// ProjectsListPage.tsx) render with. All three mockup tiers render from this
// one component; projectsTheme.css's real @media breakpoints do the layout
// switching (hero grid collapses, contacts go 2-up, overview grid goes
// single-column, etc.), not separate React branches.
//
// Kept the existing six project-level tabs (Overview / Orders & Deliveries /
// Support / Documents / Members & Contacts / Settings) -- the mockup only
// shows four (no Members & Contacts / Settings, both added this session for
// Projects Operations), so two extra `.pj-tab` buttons were appended; the
// tab bar's `overflow-x:auto` already handles that on narrow screens.
//
// Overview tab is the main rebuild target: hero (title/badge/address/
// metagrid/contacts), a manufacturing/next-milestone banner, four quick
// actions, then a two-column grid (Project Progress timeline + ring /
// Orders & Deliveries | Project Services / Recent Documents / Recent
// Activity) -- every value in it comes from data already fetched here or by
// the hooks it calls (journeyStage.ts, orders/orderTypes.ts,
// services/serviceRequestsStore.ts, documents/projectDocumentsStore.ts,
// projectActivityStore.ts, company/companyStore.ts's useCompanyStaffTeam for
// the hero's Speedpanel-team contacts) -- never the mockup's own static
// numbers. journeyStage.ts's REAL 8-step model
// (Estimating..Quote Submitted..Completed) drives the timeline, not the
// mockup's own invented 7-label demo set (Planning/Invoice Submitted/...) --
// see that file's header comment for why a second stage vocabulary must
// never exist (a past "stage drift" bug).
// =============================================================================
import { useMemo, useState } from "react";
import {
  Send, CheckCircle2, AlertCircle, ChevronLeft,
  ShoppingCart, FileText, ClipboardCheck, Calculator, CalendarClock, Mail, Phone,
  Truck, Lock, Trash2, Pencil, Box,
} from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { Field, TextAreaField } from "../shared/fields";
import { WarningsList, IconButton } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { Drawer } from "../../ui/drawer";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { Table, type TableColumn } from "../../ui/table";
import { ConfirmDialog } from "../../ui/confirmDialog";
import { TabPanel } from "../../ui/tabs";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProject } from "./projectDetailStore";
import { useProjectCompanyNames } from "./projectsStore";
import { useCompanyStaffTeam } from "../company/companyStore";
import { STAFF_ROLES, STAFF_ROLE_LABELS, staffDisplayName } from "../company/staffTypes";
import { ReviewActionPanel } from "./ReviewActionPanel";
import { useProjectOrders } from "./orders/ordersStore";
import { useOrderDeliveriesForOrders } from "./orders/orderDeliveriesStore";
import { journeyStageForProject, journeyStageForOrder, journeyProgressPercent, JOURNEY_STAGES, JOURNEY_STAGE_LABELS } from "./journeyStage";
import { journeyMilestone, nextDeliveryDate } from "./journeyCopy";
import { ORDER_STAGE_LABELS, ORDER_STAGE_BADGE_CLASS, DELIVERY_STATUS_LABELS, totalPanelCount, summarizeOrders, type OrderRow } from "./orders/orderTypes";
import {
  useProjectActivity, STAGE_EVENT_LABELS, relativeTime,
  type StageEventType,
} from "./projectActivityStore";
import { ProjectDocumentsCard } from "./documents/ProjectDocumentsCard";
import { useProjectDocuments } from "./documents/projectDocumentsStore";
import { formatFileSize } from "./documents/projectDocumentsTypes";
import { ProjectMembersCard } from "./ProjectMembersCard";
import { ProjectServicesCard } from "./services/ProjectServicesCard";
import { useProjectServiceRequests, useServiceEligibility } from "./services/serviceRequestsStore";
import { ServiceRequestForm } from "./services/ServiceRequestForm";
import { SERVICE_REQUEST_TYPES, SERVICE_REQUEST_TYPE_LABELS, type ServiceRequestType } from "./services/serviceRequestTypes";
import { ProjectContactsCard } from "./ProjectContactsCard";
import { ProjectNotificationPreferencesCard } from "./ProjectNotificationPreferencesCard";
import { ProjectLifecycleCard } from "./ProjectLifecycleCard";
import type { ProjectRow } from "./projectTypes";
import "./projectsTheme.css";

const EVENT_ICON: Record<StageEventType, { Icon: typeof Send; className: string }> = {
  install_review_requested: { Icon: Send, className: "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" },
  technical_review_requested: { Icon: Send, className: "bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300" },
  install_review_approved: { Icon: CheckCircle2, className: "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300" },
  technical_review_approved: { Icon: CheckCircle2, className: "bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300" },
  install_review_changes_requested: { Icon: AlertCircle, className: "bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300" },
  technical_review_changes_requested: { Icon: AlertCircle, className: "bg-amber-50 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300" },
};

const PROJECT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders & Deliveries" },
  { id: "support", label: "Support" },
  { id: "documents", label: "Documents" },
  { id: "people", label: "Members & Contacts" },
  { id: "settings", label: "Settings" },
];

// First-letter-of-each-word initials for the hero contact avatars --
// derived from the real staff display name, never a fabricated placeholder.
const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

// Overview tab's "Technical Review"/"Pre-Start Meeting" quick actions open
// this -- the same Support & Services request flow (services/
// serviceRequestsStore.ts) the "Project Services" panel below and
// ProjectsListPage.tsx's per-card Technical action already use. Deliberately
// NOT the design-review pipeline's requestInstallReview/requestTechnicalReview
// (project.stage machine) -- the mockup's "Technical Review" tile matches the
// Project Services panel directly beneath it, a different feature/table.
const ServiceActionDrawer = ({ projectId, projectName, requestType, layoutMode, onClose }: {
  projectId: string; projectName: string; requestType: ServiceRequestType; layoutMode: EffectiveLayout; onClose: () => void;
}) => {
  const { createRequest } = useProjectServiceRequests(projectId);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Drawer open onClose={onClose} layoutMode={layoutMode} title={`Request sent -- ${projectName}`}>
        <p className="text-sm" style={{ color: NAVY }}>Your {SERVICE_REQUEST_TYPE_LABELS[requestType].toLowerCase()} request has been sent.</p>
        <Button className="mt-4" onClick={onClose}>Done</Button>
      </Drawer>
    );
  }
  return (
    <ServiceRequestForm requestType={requestType} layoutMode={layoutMode} onClose={onClose}
      onSubmit={fields => createRequest(requestType, fields)} onCreated={() => setDone(true)} />
  );
};

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
  const { staff: speedpanelTeam } = useCompanyStaffTeam(project?.company_id ?? null);
  const { eligibility } = useServiceEligibility(id);
  const { documents } = useProjectDocuments(id, userId);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [serviceFormType, setServiceFormType] = useState<ServiceRequestType | null>(null);

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
  const progressPct = journey ? journeyProgressPercent(journey.stage, representativeOrder) : 0;

  const recentOrders = useMemo(() => [...nonCancelledOrders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2), [nonCancelledOrders]);
  const upcomingDeliveryDate = nextDeliveryDate(allDeliveries);
  const upcomingDelivery = allDeliveries.find(d => (d.confirmed_date ?? d.requested_date) === upcomingDeliveryDate);

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

  const companyName = project.company_id ? companyNames.get(project.company_id) : undefined;
  const milestone = journeyMilestone(journey.stage, {
    estimatingNote: journey.estimatingNote,
    estCompletion: representativeOrder?.manufacturing_est_completion,
    nextDeliveryDate: upcomingDeliveryDate,
  });
  const bannerHeadline = journey.stage === "manufacturing" ? `Manufacturing is ${progressPct}% complete` : milestone.label;
  const showManufacturingRing = ["processing", "manufacturing", "ready_for_delivery"].includes(journey.stage) && representativeOrder;

  const summary = summarizeOrders(orders);
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

  const recentDocuments = documents.slice(0, 3);
  const recentEvents = events.slice(0, 3);

  return (
    <div className="pj-shell mt-2">
      <button onClick={onBack} className="pj-back">
        <ChevronLeft size={16} />All Projects
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

      {serviceFormType && (
        <ServiceActionDrawer projectId={project.id} projectName={project.name} requestType={serviceFormType}
          layoutMode={layoutMode} onClose={() => setServiceFormType(null)} />
      )}

      <section className="pj-hero">
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
          <div className="pj-herogrid">
            <div>
              <div className="pj-titleline">
                <h1>{project.name}</h1>
                <span className={`pj-badge ${journey.stage === "completed" ? "complete" : ""}`}>{JOURNEY_STAGE_LABELS[journey.stage]}</span>
                <IconButton onClick={startRename} title="Edit details" ariaLabel="Edit project details"><Pencil size={13} /></IconButton>
              </div>
              <div className="pj-heroaddress">
                {project.data.siteAddress || "No address on file"}
                {companyName ? ` · ${companyName}` : ""}
              </div>
              <div className="pj-metagrid">
                <div className="pj-metabox"><span>Project Number</span><strong>{project.project_number || project.id.slice(0, 8).toUpperCase()}</strong></div>
                <div className="pj-metabox"><span>Builder</span><strong>{project.builder_name || "—"}</strong></div>
                <div className="pj-metabox"><span>Customer PM</span><strong>{project.data.customerName || "—"}</strong></div>
                <div className="pj-metabox"><span>Start Date</span><strong>{project.start_date ? new Date(project.start_date).toLocaleDateString() : "—"}</strong></div>
              </div>
            </div>
            <div className="pj-contacts">
              {speedpanelTeam.length === 0 ? (
                <p className={cx.footnote} style={{ paddingTop: 0 }}>Your Speedpanel team hasn't been assigned yet.</p>
              ) : (
                STAFF_ROLES.filter(role => !["internal_sales", "dispatch", "technical_services"].includes(role)).map(role => {
                  const contact = speedpanelTeam.find(m => m.role === role);
                  if (!contact) return null;
                  const display = staffDisplayName(contact);
                  return (
                    <div key={role} className="pj-contact">
                      <span className="pj-contactavatar">{initials(display)}</span>
                      <div className="pj-contactcopy"><strong>{display}</strong><span>{STAFF_ROLE_LABELS[role]}</span></div>
                      <div className="pj-contacttools">
                        <button className="pj-mini" disabled={!contact.email} title="Email" onClick={() => contact.email && (window.location.href = `mailto:${contact.email}`)}><Mail /></button>
                        <button className="pj-mini" disabled={!contact.phone} title="Call" onClick={() => contact.phone && (window.location.href = `tel:${contact.phone}`)}><Phone /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {actionError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{actionError}</p>}
      </section>

      <WarningsList warnings={summaryWarnings} />

      <nav className="pj-tabs">
        {PROJECT_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`pj-tab ${activeTab === t.id ? "active" : ""}`}>{t.label}</button>
        ))}
      </nav>

      <TabPanel id="overview" activeId={activeTab}>
        <div className="pj-banner">
          <div className="pj-bcopy">
            <span className="pj-bicon">i</span>
            <div><strong>{bannerHeadline}</strong><span>{milestone.note}</span></div>
          </div>
          <button className="pj-primary" onClick={() => document.getElementById("pj-progress-section")?.scrollIntoView({ behavior: "smooth" })}>View Order Progress</button>
        </div>

        <div className="pj-actiongrid">
          <button className="pj-paction" onClick={() => onCreateQuickOrder(project.id)}>
            <span className="pj-qicon"><ShoppingCart size={16} /></span>
            <div><strong>Quick Order</strong><span>Start another project order</span></div>
          </button>
          <button className="pj-paction" disabled={!(eligibility.technical_review?.available ?? false)} onClick={() => setServiceFormType("technical_review")}>
            <span className="pj-qicon"><ClipboardCheck size={16} /></span>
            <div><strong>Technical Review</strong><span>Ask a project-specific question</span></div>
          </button>
          <button className="pj-paction" disabled={!(eligibility.pre_start_meeting?.available ?? false)} onClick={() => setServiceFormType("pre_start_meeting")}>
            <span className="pj-qicon"><CalendarClock size={16} /></span>
            <div><strong>Pre-Start Meeting</strong><span>Request phone, online or site meeting</span></div>
          </button>
          <button className="pj-paction" onClick={() => setActiveTab("documents")}>
            <span className="pj-qicon"><FileText size={16} /></span>
            <div><strong>My Documents</strong><span>Quotes, invoices and project files</span></div>
          </button>
          <button className="pj-paction" onClick={() => onOpenEstimator(project)}>
            <span className="pj-qicon"><Calculator size={16} /></span>
            <div><strong>Open Estimate</strong><span>Continue in the Estimator</span></div>
          </button>
          <button className="pj-paction" onClick={() => onCreateOrder(project.id)}>
            <span className="pj-qicon"><Box size={16} /></span>
            <div><strong>Create Order</strong><span>Order from your saved Estimator design</span></div>
          </button>
        </div>

        <div className="pj-overviewgrid">
          <div>
            <section className="pj-section" id="pj-progress-section">
              <div className="pj-sectionhead"><div><h2>Project Progress</h2><p>Commercial, manufacturing and delivery lifecycle</p></div></div>
              <div className="pj-timeline">
                {JOURNEY_STAGES.map((s, i) => {
                  const activeIndex = JOURNEY_STAGES.indexOf(journey.stage);
                  const state = i < activeIndex ? "done" : i === activeIndex ? "current" : "";
                  return (
                    <div key={s} className={`pj-stage ${state}`}>
                      <div className="pj-dot">{state === "done" ? "✓" : ""}</div>
                      <strong>{JOURNEY_STAGE_LABELS[s]}</strong>
                      <span>{state === "done" ? "Done" : state === "current" ? "Current" : "Next"}</span>
                    </div>
                  );
                })}
              </div>
              {showManufacturingRing && (
                <div className="pj-manufacturing">
                  <div>
                    <h3>Manufacturing in progress</h3>
                    <p>
                      Order {representativeOrder!.id.slice(0, 8).toUpperCase()}
                      {representativeOrder!.manufacturing_est_completion && ` · Target completion ${new Date(representativeOrder!.manufacturing_est_completion).toLocaleDateString()}`}
                      {` · Updated ${relativeTime(representativeOrder!.updated_at)}`}
                    </p>
                  </div>
                  <div className="pj-ring" style={{ background: `conic-gradient(var(--pj-blue) 0 ${progressPct}%, #dbe7ee ${progressPct}% 100%)` }}>
                    <strong>{progressPct}%</strong>
                  </div>
                </div>
              )}
            </section>

            <section className="pj-section">
              <div className="pj-sectionhead"><div><h2>Orders &amp; Deliveries</h2><p>Current project activity</p></div><button className="pj-link" onClick={() => setActiveTab("orders")}>View All</button></div>
              {recentOrders.length === 0 && !upcomingDelivery ? (
                <EmptyState message="No orders yet." />
              ) : (
                <>
                  {recentOrders.map(o => {
                    const orderStage = journeyStageForOrder(o, deliveriesByOrder.get(o.id) ?? []);
                    const pct = journeyProgressPercent(orderStage, o);
                    return (
                      <div key={o.id} className="pj-row">
                        <span className="pj-rowicon"><ShoppingCart size={16} /></span>
                        <div className="pj-rowcopy">
                          <strong>Order {o.id.slice(0, 8).toUpperCase()}</strong>
                          <span>
                            {ORDER_STAGE_LABELS[o.stage]}
                            {o.manufacturing_est_completion && ` · Target completion ${new Date(o.manufacturing_est_completion).toLocaleDateString()}`}
                          </span>
                        </div>
                        <span className="pj-tag">{pct}%</span>
                      </div>
                    );
                  })}
                  {upcomingDelivery && (
                    <div className="pj-row">
                      <span className="pj-rowicon"><Truck size={16} /></span>
                      <div className="pj-rowcopy">
                        <strong>Delivery</strong>
                        <span>
                          {upcomingDelivery.confirmed_date ? `Confirmed for ${new Date(upcomingDelivery.confirmed_date).toLocaleDateString()}` : `Requested for ${new Date(upcomingDelivery.requested_date!).toLocaleDateString()}`}
                        </span>
                      </div>
                      <span className="pj-tag">{DELIVERY_STATUS_LABELS[upcomingDelivery.status]}</span>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          <div>
            <section className="pj-section">
              <div className="pj-sectionhead"><div><h2>Project Services</h2><p>Availability based on project progress</p></div><button className="pj-link" onClick={() => setActiveTab("support")}>View All</button></div>
              {SERVICE_REQUEST_TYPES.map(type => {
                const available = eligibility[type]?.available ?? false;
                return (
                  <div key={type} className={`pj-service ${available ? "" : "locked"}`}>
                    <span className="pj-serviceicon">{available ? <CheckCircle2 size={16} /> : <Lock size={14} />}</span>
                    <div className="pj-servicecopy">
                      <strong>{SERVICE_REQUEST_TYPE_LABELS[type]}</strong>
                      <span>{available ? "Available now" : (eligibility[type]?.message ?? "Not yet available")}</span>
                    </div>
                    <span className="pj-tag">{available ? "Available" : "Locked"}</span>
                  </div>
                );
              })}
            </section>

            <section className="pj-section">
              <div className="pj-sectionhead"><div><h2>Recent Documents</h2><p>Latest project files</p></div><button className="pj-link" onClick={() => setActiveTab("documents")}>View All</button></div>
              {recentDocuments.length === 0 ? (
                <EmptyState message="No documents yet." />
              ) : recentDocuments.map(doc => (
                <div key={doc.id} className="pj-row">
                  <span className="pj-rowicon"><FileText size={16} /></span>
                  <div className="pj-rowcopy">
                    <strong>{doc.file_name}</strong>
                    <span>{formatFileSize(doc.file_size)} &middot; Added {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  <span className="pj-tag">{doc.file_name.split(".").pop()?.toUpperCase() || "FILE"}</span>
                </div>
              ))}
            </section>

            <section className="pj-section">
              <div className="pj-sectionhead"><div><h2>Recent Activity</h2><p>Latest project changes</p></div></div>
              {activityLoading ? (
                <p className={cx.footnote} style={{ paddingTop: 0 }}>Loading...</p>
              ) : activityError ? (
                <p className="text-sm text-red-600 dark:text-red-300">{activityError}</p>
              ) : recentEvents.length === 0 ? (
                <EmptyState message="No activity yet." />
              ) : recentEvents.map(e => {
                const { Icon } = EVENT_ICON[e.event_type];
                return (
                  <div key={e.id} className="pj-row">
                    <span className="pj-rowicon"><Icon size={16} /></span>
                    <div className="pj-rowcopy">
                      <strong>{STAGE_EVENT_LABELS[e.event_type]}</strong>
                      <span>{relativeTime(e.created_at)}</span>
                    </div>
                    <span className="pj-tag">Update</span>
                  </div>
                );
              })}
            </section>
          </div>
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
        <div className="mt-4">
          <Button variant="danger" icon={<Trash2 size={15} />} disabled={deleting} onClick={() => setConfirmDelete(true)}>
            {deleting ? "Deleting..." : "Delete project"}
          </Button>
        </div>
      </TabPanel>
    </div>
  );
};
