// =============================================================================
// Projects -- All Projects page (project-finding/project-entry screen)
// =============================================================================
// Restyled to match UI-DESIGNS/customer/{desktop,ipad,phone}/
// customer-orders-overview.html exactly -- see projectsTheme.css for the
// scoped `.pj-*` palette/shape this page (and ProjectDetailPage.tsx) render
// with. All THREE mockup tiers (phone/iPad/desktop) render from this one
// component; projectsTheme.css's real @media breakpoints do the layout
// switching, not separate React branches, per CUSTOMER-UI-DEVICE-
// INSTRUCTIONS/01-RESPONSIVE-BUILD-RULES.md ("production remains one
// responsive React implementation, not three separate React pages") --
// ProjectWebCard/ProjectPhoneCard collapsed into one ProjectCard as a result.
//
// A row click opens that project's own ProjectDetailPage.tsx (see
// ProjectsRouter.tsx -- #/projects and #/projects/:id are two distinct
// views); the card's own Order/Technical/Documents actions deliberately do
// NOT navigate there -- Order goes to the dedicated Quick Order flow,
// Technical/Documents open a scoped Drawer right from this page.
//
// Journey stage (the 8-step Estimating..Completed pipeline) is a
// DISPLAY-ONLY value computed by journeyStage.ts from each project's real
// orders/manufacturing/delivery data -- see that file's header comment for
// why it's never a persisted column. The progress line's label/value
// (progressInfo() below) is likewise derived from real
// useProjectsJourney() data (progress %, or delivered/total delivery
// counts once deliveries exist) -- never the mockup's own static numbers.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Building2, CalendarClock, ChevronRight, ClipboardCheck, FileText,
  Plus, Search, ShoppingCart, SlidersHorizontal,
} from "lucide-react";
import { NAVY, MUTED } from "../../styleTokens";
import { Field, SelectField, TextAreaField } from "../shared/fields";
import { Button } from "../../ui/button";
import { Drawer } from "../../ui/drawer";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProjects, useProjectCompanyNames } from "./projectsStore";
import { useCompanyMembers } from "../company/companyStore";
import { useProjectsJourney, type ProjectJourneyInfo } from "./projectsJourneyStore";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, type JourneyStage } from "./journeyStage";
import { relativeTime } from "./projectActivityStore";
import { ProjectPickerDrawer } from "./ProjectPickerDrawer";
import { useProjectServiceRequests } from "./services/serviceRequestsStore";
import { ServiceRequestForm } from "./services/ServiceRequestForm";
import { ProjectDocumentsCard } from "./documents/ProjectDocumentsCard";
import type { OrderDeliveryRow } from "./orders/orderTypes";
import type { ProjectRow } from "./projectTypes";
import "./projectsTheme.css";

// A project needs the customer's attention when Speedpanel has asked for
// changes on either half of the pre-order design-review pipeline -- the one
// "requires attention" signal already available on every ProjectRow without
// an extra per-project fetch (open service requests would be a second such
// signal; left for a future pass rather than an N+1 fetch here).
const requiresAttention = (p: ProjectRow): boolean =>
  p.install_review_status === "changes_requested" || p.technical_review_status === "changes_requested";

// The progress line under each card's badge -- label/value/bar-% all real:
// once deliveries exist for the representative order, show delivered/total
// (matching the mockup's "Deliveries complete: 2 of 3"); otherwise the
// coarse journeyProgressPercent() the rest of the app already uses.
function progressInfo(stage: JourneyStage, progress: number, deliveries: OrderDeliveryRow[]): { label: string; valueText: string; pct: number } {
  if (stage === "completed") return { label: "Project complete", valueText: "100%", pct: 100 };
  if ((stage === "ready_for_delivery" || stage === "delivered") && deliveries.length > 0) {
    const delivered = deliveries.filter(d => d.status === "delivered").length;
    return { label: "Deliveries complete", valueText: `${delivered} of ${deliveries.length}`, pct: Math.round((delivered / deliveries.length) * 100) };
  }
  if (stage === "manufacturing") return { label: "Manufacturing progress", valueText: `${progress}%`, pct: progress };
  return { label: "Order progress", valueText: `${progress}%`, pct: progress };
}

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

// One project row -- identity/status/actions three-zone card on desktop,
// status block moves below (stacked) on iPad/phone via projectsTheme.css's
// media queries, not a separate component.
const ProjectCard = ({ item, journey, companyName, pmEmail, onOpen, onQuickOrder, onTechnical, onDocuments }: {
  item: ProjectRow; journey: ProjectJourneyInfo | undefined; companyName: string | undefined; pmEmail: string | undefined;
  onOpen: () => void; onQuickOrder: () => void; onTechnical: () => void; onDocuments: () => void;
}) => {
  const stage = journey?.journey.stage ?? "estimating";
  const attention = requiresAttention(item);
  const info = progressInfo(stage, journey?.progress ?? 0, journey?.representativeDeliveries ?? []);

  return (
    <article className="pj-projectcard">
      <button onClick={onOpen} className="pj-projectid">
        <span className="pj-projecticon"><Building2 size={18} /></span>
        <div style={{ minWidth: 0 }}>
          <h2>{item.name}</h2>
          <div className="pj-address">{item.data.siteAddress || "No address on file"}</div>
          <div className="pj-meta">
            <span>{item.project_number || item.id.slice(0, 8).toUpperCase()}</span>
            {item.builder_name && <span>Builder: {item.builder_name}</span>}
            {pmEmail && <span>PM: {pmEmail}</span>}
            {companyName && <span>{companyName}</span>}
          </div>
        </div>
      </button>

      <div className="pj-statusblock">
        <div className="pj-statusline">
          <span className={`pj-badge ${stage === "completed" ? "complete" : ""}`}>{JOURNEY_STAGE_LABELS[stage]}</span>
          {attention && <span className="pj-alert">Needs attention</span>}
        </div>
        <div className="pj-progresslabel"><span>{info.label}</span><strong>{info.valueText}</strong></div>
        <div className="pj-progress"><span style={{ width: `${info.pct}%`, background: stage === "completed" ? "var(--pj-green)" : undefined }} /></div>
        <div className="pj-updated">Updated {relativeTime(item.updated_at)}</div>
      </div>

      <div className="pj-cardactions">
        <button onClick={onQuickOrder} className="pj-act"><ShoppingCart size={16} /><span>Order</span></button>
        <button onClick={onTechnical} className="pj-act"><ClipboardCheck size={16} /><span>Technical</span></button>
        <button onClick={onDocuments} className="pj-act"><FileText size={16} /><span>Documents</span></button>
      </div>
    </article>
  );
};

// Card-level "Technical" action -- opens a Technical Review request form
// scoped to one project, without navigating to that project's own page.
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
    <div className="pj-shell mt-2">
      <div className="pj-pagehead">
        <div>
          <h1>Projects</h1>
          <p>Manage your projects, orders, documents and support requests.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasCompany && <button onClick={onTeam} className="text-sm font-bold" style={{ color: "var(--pj-blue)" }}>Team &rarr;</button>}
          {!loading && !error && <div className="pj-count">{projects.length} active</div>}
        </div>
      </div>

      <div className="pj-quickrow">
        <button className="pj-quick" onClick={() => setShowCreate(true)}>
          <div className="pj-quickcopy">
            <span className="pj-qicon"><Plus size={18} /></span>
            <div><strong>Create New Project</strong><small>Add project details and assign a company project manager.</small></div>
          </div>
          <span className="pj-arrow"><ChevronRight size={16} /></span>
        </button>
        <button className="pj-quick" onClick={() => setShowQuickOrderPicker(true)}>
          <div className="pj-quickcopy">
            <span className="pj-qicon"><ShoppingCart size={18} /></span>
            <div><strong>Quick Order</strong><small>Select a project and start an order immediately.</small></div>
          </div>
          <span className="pj-arrow"><ChevronRight size={16} /></span>
        </button>
        <button className="pj-quick" onClick={() => setShowPrestartPicker(true)}>
          <div className="pj-quickcopy">
            <span className="pj-qicon"><CalendarClock size={18} /></span>
            <div><strong>Request Pre-Start</strong><small>Request a phone, online or site meeting.</small></div>
          </div>
          <span className="pj-arrow"><ChevronRight size={16} /></span>
        </button>
      </div>

      <div className="pj-toolbar">
        <div className="pj-search">
          <Search size={18} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by project name, address, builder or project number" />
        </div>
        <div className="pj-segmented">
          {(["all", "active", "completed"] as const).map(t => (
            <button key={t} onClick={() => setPrimaryTab(t)} className={`pj-seg ${primaryTab === t ? "active" : ""}`}>
              {t === "all" ? "All" : t === "active" ? "Active" : "Completed"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters(v => !v)} className="pj-filter" aria-expanded={showFilters}>
          <SlidersHorizontal size={15} /><span>Filters</span>
        </button>
      </div>

      {showFilters && (
        <div className="pj-section grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="pj-projectlist">
          {sorted.map(item => (
            <ProjectCard key={item.id} item={item} journey={journeyByProject.get(item.id)}
              companyName={companyNames.get(item.company_id ?? "")} pmEmail={pmEmailFor(item.project_manager_user_id)}
              onOpen={() => onOpenProject(item.id)} onQuickOrder={() => onQuickOrder(item.id)}
              onTechnical={() => setTechnicalTarget(item)} onDocuments={() => setDocumentsTarget(item)} />
          ))}
          {sorted.length === 0 && <EmptyState className="mt-3" message="No projects match your search." />}
        </div>
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
