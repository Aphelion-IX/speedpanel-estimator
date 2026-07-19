// =============================================================================
// Projects -- All Projects page (project-finding/project-entry screen)
// =============================================================================
// Redesigned per the Projects Experience Redesign spec: a header, a quick-
// actions row (Create New Project / Quick Order / Request Pre-Start
// Meeting), search + primary (All/Active/Completed) + secondary filters,
// then the project list -- horizontal 3-zone cards (identity / status /
// actions) on web, stacked cards with a 3-action row on phone. A row click
// opens that project's own ProjectDetailPage.tsx (see ProjectsRouter.tsx --
// #/projects and #/projects/:id are two distinct views); the card's own
// Order/Technical/Documents actions deliberately do NOT navigate there (spec
// section 8: "Action buttons must not trigger project navigation") -- Order
// goes to the dedicated Quick Order flow, Technical/Documents open a scoped
// Drawer right from this page.
//
// Journey stage (the 8-step Estimating..Completed pipeline) is a
// DISPLAY-ONLY value computed by journeyStage.ts from each project's real
// orders/manufacturing/delivery data -- see that file's header comment for
// why it's never a persisted column. The bottom Projects/Orders stat rows
// deliberately keep showing the REAL project.stage (draft/install_review/
// technical_review/approved) and order.stage pipelines untouched.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Building2, CalendarClock, ChevronDown, ChevronRight, ClipboardCheck, FileText,
  Plus, Search, ShoppingCart, SlidersHorizontal,
} from "lucide-react";
import { cx, tone, NAVY, BLUE, MUTED } from "../../styleTokens";
import { r1 } from "../../estimate/mathUtils";
import { Field, SelectField, TextAreaField } from "../shared/fields";
import { Stat } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { Drawer } from "../../ui/drawer";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProjects, useProjectCompanyNames } from "./projectsStore";
import { useCompanyMembers } from "../company/companyStore";
import { useProjectsJourney, type ProjectJourneyInfo } from "./projectsJourneyStore";
import { useProjectPhoneStats } from "./projectPhoneStats";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, JOURNEY_STAGE_BADGE_CLASS, type JourneyStage } from "./journeyStage";
import { relativeTime } from "./projectActivityStore";
import { ProjectPickerDrawer } from "./ProjectPickerDrawer";
import { useProjectServiceRequests } from "./services/serviceRequestsStore";
import { ServiceRequestForm } from "./services/ServiceRequestForm";
import { ProjectDocumentsCard } from "./documents/ProjectDocumentsCard";
import type { ProjectRow } from "./projectTypes";

// A project needs the customer's attention when Speedpanel has asked for
// changes on either half of the pre-order design-review pipeline -- the one
// "requires attention" signal already available on every ProjectRow without
// an extra per-project fetch (open service requests would be a second such
// signal; left for a future pass rather than an N+1 fetch here).
const requiresAttention = (p: ProjectRow): boolean =>
  p.install_review_status === "changes_requested" || p.technical_review_status === "changes_requested";

export interface NewProjectMeta { reference: string; siteAddress: string; customerName: string; description: string; }

// =============================================================================
// Create Project -- responsive Drawer (right panel on web, bottom sheet on
// phone) with the spec's field set: name/address required, builder/PM/start
// date/customer reference optional. PM is a company-member dropdown when the
// project belongs to a company workspace; omitted entirely for a solo account
// (there's no roster to pick from).
// =============================================================================
const CreateProjectDrawer = ({ layoutMode, activeCompanyId, onCreate, onClose }: {
  layoutMode: EffectiveLayout; activeCompanyId: string | null;
  onCreate: (name: string, meta: NewProjectMeta, fields: { builderName?: string; startDate?: string; projectManagerUserId?: string }) => Promise<string | null>;
  onClose: () => void;
}) => {
  const { members } = useCompanyMembers(activeCompanyId);
  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [reference, setReference] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectManagerUserId, setProjectManagerUserId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pmOptions = [{ value: "", label: "Unassigned" }, ...members.map(m => ({ value: m.user_id, label: `${m.email ?? m.user_id} (${m.role})` }))];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !siteAddress.trim()) return;
    setCreating(true);
    setError(null);
    const err = await onCreate(
      name.trim(),
      { reference, siteAddress, customerName, description },
      { builderName: builderName.trim() || undefined, startDate: startDate || undefined, projectManagerUserId: projectManagerUserId || undefined },
    );
    setCreating(false);
    if (err) { setError(err); return; }
    onClose();
  };

  return (
    <Drawer open onClose={onClose} layoutMode={layoutMode} title="Create New Project">
      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <Field label="Project name" value={name} onChange={setName} required />
        <Field label="Project address" value={siteAddress} onChange={setSiteAddress} required />
        <Field label="Builder (optional)" value={builderName} onChange={setBuilderName} />
        {activeCompanyId && members.length > 0 && (
          <SelectField label="Project Manager (optional)" value={projectManagerUserId} options={pmOptions} onChange={setProjectManagerUserId} />
        )}
        <Field label="Start date (optional)" value={startDate} onChange={setStartDate} type="date" />
        <Field label="Customer project reference (optional)" value={reference} onChange={setReference} />
        <Field label="Customer or company (optional)" value={customerName} onChange={setCustomerName} />
        <TextAreaField label="Description (optional)" value={description} onChange={setDescription} />

        {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={creating || !name.trim() || !siteAddress.trim()} className="h-[46px] shrink-0">
            {creating ? "Creating..." : "Create Project"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  );
};

// =============================================================================
// Quick actions row -- Create New Project / Quick Order / Request Pre-Start
// Meeting. Horizontal rail on phone (spec: "Mobile: Horizontal quick-action
// rail"), a card grid on web.
// =============================================================================
const QuickActionTile = ({ icon, title, note, onClick, layoutMode }: {
  icon: React.ReactNode; title: string; note: string; onClick: () => void; layoutMode: EffectiveLayout;
}) => (
  <button onClick={onClick}
    className={layoutMode === "phone"
      ? "flex w-52 shrink-0 flex-col items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 text-left shadow-sm"
      : `${cx.card} flex items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md`}
  >
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-900/55" style={{ color: BLUE }}>{icon}</span>
    <div className="min-w-0">
      <div className="text-sm font-extrabold" style={{ color: NAVY }}>{title}</div>
      <div className="mt-0.5 text-xs" style={{ color: MUTED }}>{note}</div>
    </div>
  </button>
);

// =============================================================================
// Project cards -- web (horizontal 3-zone row) and phone (stacked, 3-action row)
// =============================================================================
const ProjectWebCard = ({ item, journey, companyName, pmEmail, onOpen, onQuickOrder, onTechnical, onDocuments }: {
  item: ProjectRow; journey: ProjectJourneyInfo | undefined; companyName: string | undefined; pmEmail: string | undefined;
  onOpen: () => void; onQuickOrder: () => void; onTechnical: () => void; onDocuments: () => void;
}) => {
  const stage = journey?.journey.stage ?? "estimating";
  const progress = journey?.progress ?? 0;
  const attention = requiresAttention(item);

  return (
    <div className={`${cx.card} mt-3 flex flex-col gap-4 lg:flex-row lg:items-center`}>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/55">
          <Building2 size={18} style={{ color: BLUE }} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</p>
          <p className="truncate text-xs" style={{ color: MUTED }}>{item.data.siteAddress || "No address on file"}</p>
          <p className="mt-1 truncate text-xs" style={{ color: MUTED }}>
            {item.project_number || item.id.slice(0, 8).toUpperCase()}
            {item.builder_name && <> &middot; Builder: {item.builder_name}</>}
            {pmEmail && <> &middot; PM: {pmEmail}</>}
            {companyName && <> &middot; {companyName}</>}
          </p>
        </div>
      </button>

      <div className="lg:w-56 lg:shrink-0">
        <div className="flex items-center gap-2">
          <span className={`${cx.badge} ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>{JOURNEY_STAGE_LABELS[stage]}</span>
          {attention && <span className={`${cx.badge} ${tone("danger")}`}>Needs attention</span>}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: BLUE }} />
        </div>
        <p className="mt-1.5 text-xs" style={{ color: MUTED }}>Updated {relativeTime(item.updated_at)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:w-56 lg:shrink-0">
        <button onClick={onQuickOrder} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-xs font-semibold" style={{ color: NAVY }}>
          <ShoppingCart size={15} style={{ color: BLUE }} />Order
        </button>
        <button onClick={onTechnical} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-xs font-semibold" style={{ color: NAVY }}>
          <ClipboardCheck size={15} style={{ color: BLUE }} />Technical
        </button>
        <button onClick={onDocuments} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-xs font-semibold" style={{ color: NAVY }}>
          <FileText size={15} style={{ color: BLUE }} />Documents
        </button>
      </div>
    </div>
  );
};

const ProjectPhoneCard = ({ item, journey, companyName, onOpen, onQuickOrder, onTechnical, onDocuments }: {
  item: ProjectRow; journey: ProjectJourneyInfo | undefined; companyName: string | undefined;
  onOpen: () => void; onQuickOrder: () => void; onTechnical: () => void; onDocuments: () => void;
}) => {
  const stage = journey?.journey.stage ?? "estimating";
  const progress = journey?.progress ?? 0;
  const phoneStats = useProjectPhoneStats(item);
  const attention = requiresAttention(item);

  return (
    <div className={`${cx.card} mt-3`}>
      <button onClick={onOpen} className="flex w-full items-start justify-between gap-2 text-left">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
          <div className="truncate text-xs" style={{ color: MUTED }}>{item.data.siteAddress || `Ref: ${item.data.reference || item.id.slice(0, 8).toUpperCase()}`}{companyName ? ` · ${companyName}` : ""}</div>
        </div>
        <ChevronRight size={18} className="shrink-0" style={{ color: MUTED }} />
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`${cx.badge} ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>{JOURNEY_STAGE_LABELS[stage]}</span>
        {attention && <span className={`${cx.badge} ${tone("danger")}`}>Needs attention</span>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Stat value={phoneStats.wallCount} label="Walls" />
        <Stat value={`${r1(phoneStats.area)} m²`} label="Area" />
        <Stat value={phoneStats.panels} label="Panels" />
      </div>
      <div className="mt-2.5 text-xs" style={{ color: MUTED }}>{Math.round(progress)}% complete</div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button onClick={onQuickOrder} className="flex flex-col items-center gap-1 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/55 py-2.5 text-xs font-bold" style={{ color: BLUE }}>
          <ShoppingCart size={15} />Order
        </button>
        <button onClick={onTechnical} className="flex flex-col items-center gap-1 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/55 py-2.5 text-xs font-bold" style={{ color: BLUE }}>
          <ClipboardCheck size={15} />Technical
        </button>
        <button onClick={onDocuments} className="flex flex-col items-center gap-1 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/55 py-2.5 text-xs font-bold" style={{ color: BLUE }}>
          <FileText size={15} />Documents
        </button>
      </div>
    </div>
  );
};

// Card-level "Technical" action -- opens a Technical Review request form
// scoped to one project, without navigating to that project's own page (spec:
// "Action buttons must not trigger project navigation").
const CardTechnicalDrawer = ({ project, layoutMode, onClose }: { project: ProjectRow; layoutMode: EffectiveLayout; onClose: () => void }) => {
  const { createRequest } = useProjectServiceRequests(project.id);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Drawer open onClose={onClose} layoutMode={layoutMode} title={`Request sent -- ${project.name}`}>
        <p className="text-sm" style={{ color: NAVY }}>Your technical review request has been sent. Open the project's Support tab any time to follow up.</p>
        <Button className="mt-4" onClick={onClose}>Done</Button>
      </Drawer>
    );
  }
  return (
    <ServiceRequestForm requestType="technical_review" layoutMode={layoutMode} onClose={onClose}
      onSubmit={fields => createRequest("technical_review", fields)} onCreated={() => setDone(true)} />
  );
};

const CardDocumentsDrawer = ({ project, userId, layoutMode, onClose }: {
  project: ProjectRow; userId: string | null; layoutMode: EffectiveLayout; onClose: () => void;
}) => (
  <Drawer open onClose={onClose} layoutMode={layoutMode} title={`Documents -- ${project.name}`}>
    <ProjectDocumentsCard projectId={project.id} userId={userId} />
  </Drawer>
);

export const ProjectsListPage = ({ user, onOpenProject, onQuickOrder, layoutMode, hasCompany, activeCompanyId, onTeam }: {
  user: User | null; onOpenProject: (id: string) => void; onQuickOrder: (id: string) => void; layoutMode: EffectiveLayout;
  hasCompany: boolean; activeCompanyId: string | null; onTeam: () => void;
}) => {
  const { projects, loading, error, reload, createProject } = useProjects(user, activeCompanyId);
  const { byProject: journeyByProject, loading: journeyLoading } = useProjectsJourney(user, projects);
  const companyNames = useProjectCompanyNames(useMemo(() => [...new Set(projects.map(p => p.company_id).filter((id): id is string => !!id))], [projects]));
  const { members: companyMembers } = useCompanyMembers(activeCompanyId ?? null);

  const [query, setQuery] = useState("");
  const [primaryTab, setPrimaryTab] = useState<"all" | "active" | "completed">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState<"all" | JourneyStage>("all");
  const [builderFilter, setBuilderFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"updated" | "name" | "start_date" | "stage">("updated");

  const [showCreate, setShowCreate] = useState(false);
  const [showQuickOrderPicker, setShowQuickOrderPicker] = useState(false);
  const [showPrestartPicker, setShowPrestartPicker] = useState(false);
  const [prestartProject, setPrestartProject] = useState<ProjectRow | null>(null);
  const [technicalTarget, setTechnicalTarget] = useState<ProjectRow | null>(null);
  const [documentsTarget, setDocumentsTarget] = useState<ProjectRow | null>(null);

  const pmEmailFor = (userId: string | null) => userId ? companyMembers.find(m => m.user_id === userId)?.email ?? undefined : undefined;

  const builders = useMemo(() => [...new Set(projects.map(p => p.builder_name).filter((b): b is string => !!b))].sort(), [projects]);

  const filtered = useMemo(() => projects.filter(p => {
    const stage = journeyByProject.get(p.id)?.journey.stage ?? "estimating";
    if (primaryTab === "active" && stage === "completed") return false;
    if (primaryTab === "completed" && stage !== "completed") return false;
    if (stageFilter !== "all" && stage !== stageFilter) return false;
    if (builderFilter !== "all" && p.builder_name !== builderFilter) return false;
    if (attentionOnly && !requiresAttention(p)) return false;
    if (query.trim()) {
      const company = companyNames.get(p.company_id ?? "") ?? "";
      const hay = [p.name, p.data.siteAddress ?? "", p.builder_name ?? "", p.project_number ?? "", p.id, company].join(" ").toLowerCase();
      if (!hay.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  }), [projects, primaryTab, stageFilter, builderFilter, attentionOnly, query, journeyByProject, companyNames]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortBy === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "start_date") arr.sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""));
    else if (sortBy === "stage") {
      arr.sort((a, b) => JOURNEY_STAGES.indexOf(journeyByProject.get(b.id)?.journey.stage ?? "estimating") - JOURNEY_STAGES.indexOf(journeyByProject.get(a.id)?.journey.stage ?? "estimating"));
    }
    // "updated" (default) -- already ordered by updated_at desc from useProjects()'s own query.
    return arr;
  }, [filtered, sortBy, journeyByProject]);

  const handleCreate = async (name: string, meta: NewProjectMeta, fields: { builderName?: string; startDate?: string; projectManagerUserId?: string }) => {
    const { id, error: err } = await createProject(name, meta, fields);
    if (id) onOpenProject(id);
    return err;
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={cx.h1}>Projects</h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Manage your projects, orders, documents and support requests.
            {!loading && !error && <> &middot; {projects.length} project{projects.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        {hasCompany && <button onClick={onTeam} className="text-sm font-bold" style={{ color: BLUE }}>Team &rarr;</button>}
      </div>

      <div className={layoutMode === "phone" ? "-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-1" : "mt-4 grid gap-3 sm:grid-cols-3"}>
        <QuickActionTile layoutMode={layoutMode} icon={<Plus size={18} />} title="Create New Project"
          note="Create a project and assign the basic details." onClick={() => setShowCreate(true)} />
        <QuickActionTile layoutMode={layoutMode} icon={<ShoppingCart size={18} />} title="Quick Order"
          note="Start an order and choose the project it belongs to." onClick={() => setShowQuickOrderPicker(true)} />
        <QuickActionTile layoutMode={layoutMode} icon={<CalendarClock size={18} />} title="Request Pre-Start Meeting"
          note="Select a project and request a meeting at any stage." onClick={() => setShowPrestartPicker(true)} />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex h-10 flex-1 items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by project name, address, builder or project number"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" style={{ color: NAVY }} />
        </label>
        <div className={cx.tabList + " shrink-0"}>
          {(["all", "active", "completed"] as const).map(t => (
            <button key={t} onClick={() => setPrimaryTab(t)} className={primaryTab === t ? cx.tabActive : cx.tabInactive}>
              {t === "all" ? "All" : t === "active" ? "Active" : "Completed"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm font-semibold shadow-sm" style={{ color: NAVY }}>
          <SlidersHorizontal size={15} />Filters
          <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} style={{ color: MUTED }} />
        </button>
      </div>

      {showFilters && (
        <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Stage" value={stageFilter} onChange={v => setStageFilter(v as "all" | JourneyStage)}
            options={[{ value: "all", label: "All stages" }, ...JOURNEY_STAGES.map(s => ({ value: s, label: JOURNEY_STAGE_LABELS[s] }))]} />
          <SelectField label="Builder" value={builderFilter} onChange={setBuilderFilter}
            options={[{ value: "all", label: "All builders" }, ...builders.map(b => ({ value: b, label: b }))]} />
          <SelectField label="Sort by" value={sortBy} onChange={v => setSortBy(v as typeof sortBy)}
            options={[{ value: "updated", label: "Recently updated" }, { value: "name", label: "Project name" }, { value: "start_date", label: "Start date" }, { value: "stage", label: "Current stage" }]} />
          <label className="flex items-end gap-2 pb-2.5 text-sm font-semibold" style={{ color: NAVY }}>
            <input type="checkbox" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} className="h-4 w-4" />
            Requires attention only
          </label>
        </div>
      )}

      {(loading || journeyLoading) && <LoadingState className="mt-3" label="Loading projects" />}

      {!loading && error && <ErrorState className="mt-3" message={error} onRetry={() => reload()} />}

      {!loading && !error && projects.length === 0 && (
        <EmptyState className="mt-3" message="No projects yet -- create one above to get started." />
      )}

      {!loading && !error && projects.length > 0 && (
        layoutMode === "phone" ? (
          <div>
            {sorted.map(item => (
              <ProjectPhoneCard key={item.id} item={item} journey={journeyByProject.get(item.id)}
                companyName={companyNames.get(item.company_id ?? "")} onOpen={() => onOpenProject(item.id)}
                onQuickOrder={() => onQuickOrder(item.id)} onTechnical={() => setTechnicalTarget(item)} onDocuments={() => setDocumentsTarget(item)} />
            ))}
            {sorted.length === 0 && <EmptyState className="mt-3" message="No projects match your search." />}
          </div>
        ) : (
          <div>
            {sorted.map(item => (
              <ProjectWebCard key={item.id} item={item} journey={journeyByProject.get(item.id)}
                companyName={companyNames.get(item.company_id ?? "")} pmEmail={pmEmailFor(item.project_manager_user_id)}
                onOpen={() => onOpenProject(item.id)} onQuickOrder={() => onQuickOrder(item.id)}
                onTechnical={() => setTechnicalTarget(item)} onDocuments={() => setDocumentsTarget(item)} />
            ))}
            {sorted.length === 0 && <EmptyState className="mt-3" message="No projects match your search." />}
          </div>
        )
      )}

      {!loading && !error && (
        <p className="mt-3 text-sm" style={{ color: MUTED }}>Showing {sorted.length} of {projects.length} projects</p>
      )}

      {showCreate && <CreateProjectDrawer layoutMode={layoutMode} activeCompanyId={activeCompanyId} onCreate={handleCreate} onClose={() => setShowCreate(false)} />}

      {showQuickOrderPicker && (
        <ProjectPickerDrawer title="Quick Order -- choose a project" projects={projects} layoutMode={layoutMode}
          onPick={p => { setShowQuickOrderPicker(false); onQuickOrder(p.id); }} onClose={() => setShowQuickOrderPicker(false)} />
      )}

      {showPrestartPicker && !prestartProject && (
        <ProjectPickerDrawer title="Request Pre-Start Meeting -- choose a project" projects={projects} layoutMode={layoutMode}
          onPick={setPrestartProject} onClose={() => setShowPrestartPicker(false)} />
      )}
      {prestartProject && (
        <PrestartRequestFlow project={prestartProject} layoutMode={layoutMode} onOpenProject={onOpenProject}
          onClose={() => { setPrestartProject(null); setShowPrestartPicker(false); }} />
      )}

      {technicalTarget && <CardTechnicalDrawer project={technicalTarget} layoutMode={layoutMode} onClose={() => setTechnicalTarget(null)} />}
      {documentsTarget && <CardDocumentsDrawer project={documentsTarget} userId={user?.id ?? null} layoutMode={layoutMode} onClose={() => setDocumentsTarget(null)} />}
    </div>
  );
};

// Second step of the top-level "Request Pre-Start Meeting" quick action, once
// a project has been picked -- reuses ServiceRequestForm exactly like the
// per-card Technical action above, then offers to open the project.
const PrestartRequestFlow = ({ project, layoutMode, onOpenProject, onClose }: {
  project: ProjectRow; layoutMode: EffectiveLayout; onOpenProject: (id: string) => void; onClose: () => void;
}) => {
  const { createRequest } = useProjectServiceRequests(project.id);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Drawer open onClose={onClose} layoutMode={layoutMode} title={`Request sent -- ${project.name}`}>
        <p className="text-sm" style={{ color: NAVY }}>Your pre-start meeting request has been sent.</p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => onOpenProject(project.id)}>Open project</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </Drawer>
    );
  }
  return (
    <ServiceRequestForm requestType="pre_start_meeting" layoutMode={layoutMode} onClose={onClose}
      onSubmit={fields => createRequest("pre_start_meeting", fields)} onCreated={() => setDone(true)} />
  );
};
