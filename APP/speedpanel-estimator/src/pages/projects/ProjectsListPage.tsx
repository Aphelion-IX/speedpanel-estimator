// =============================================================================
// Projects -- list/overview page
// =============================================================================
// Search, real journey-stage count tabs, and a table (web) / stacked cards
// (phone) of every project -- a row click navigates to that project's own
// ProjectDetailPage.tsx (see ProjectsRouter.tsx -- #/projects and
// #/projects/:id are two distinct views, not one page with an embedded
// dashboard). "+ New Project" reuses projectsStore.ts's createProject().
//
// Journey stage (the 8-step Estimating..Completed pipeline) is a
// DISPLAY-ONLY value computed by journeyStage.ts from each project's real
// orders/manufacturing/delivery data -- see that file's header comment for
// why it's never a persisted column. The bottom Projects/Orders stat rows
// deliberately keep showing the REAL project.stage (draft/install_review/
// technical_review/approved) and order.stage pipelines untouched -- the
// journey tabs above are an additional, honest view, not a replacement for
// those existing aggregate totals.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Building2, Check, ChevronDown, FileText, Plus, Search, Settings, Truck } from "lucide-react";
import { cx, tone, NAVY, BLUE, MUTED } from "../../styleTokens";
import { r1 } from "../../estimate/mathUtils";
import { Field, TextAreaField } from "../shared/fields";
import { Stat, StatsGrid } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { Table, type TableColumn } from "../../ui/table";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProjects, useProjectCompanyNames } from "./projectsStore";
import { useOrdersSummary } from "./dashboardStore";
import { useProjectsJourney, type ProjectJourneyInfo } from "./projectsJourneyStore";
import { useProjectPhoneStats } from "./projectPhoneStats";
import { journeyMilestone, nextDeliveryDate } from "./journeyCopy";
import { StepTracker } from "./StepTracker";
import { JOURNEY_STAGES, JOURNEY_STAGE_LABELS, JOURNEY_STAGE_BADGE_CLASS, type JourneyStage } from "./journeyStage";
import { STAGES, STAGE_LABELS } from "./projectTypes";
import { ORDER_STAGES, ORDER_STAGE_LABELS } from "./orders/orderTypes";
import { relativeTime } from "./projectActivityStore";
import type { ProjectRow } from "./projectTypes";

const milestoneIcon = (stage: JourneyStage) => {
  if (stage === "ready_for_delivery") return Truck;
  if (stage === "quote_submitted" || stage === "quote_accepted") return FileText;
  if (stage === "delivered" || stage === "completed") return Check;
  return Settings;
};

export interface NewProjectMeta { reference: string; siteAddress: string; customerName: string; description: string; }

const NewProjectPanel = ({ onCreate, layoutMode }: {
  onCreate: (name: string, meta: NewProjectMeta) => Promise<string | null>; layoutMode: EffectiveLayout;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(""); setReference(""); setSiteAddress(""); setCustomerName(""); setDescription(""); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const err = await onCreate(name.trim(), { reference, siteAddress, customerName, description });
    setCreating(false);
    if (err) { setError(err); return; }
    setOpen(false);
    reset();
  };

  if (!open) {
    if (layoutMode === "phone") {
      return (
        <button onClick={() => setOpen(true)} className={`${cx.card} flex w-full items-center gap-3 text-left`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 dark:bg-blue-900/55 text-xl font-extrabold" style={{ color: BLUE }}>+</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold" style={{ color: NAVY }}>Create New Project</div>
            <div className="mt-0.5 text-xs" style={{ color: MUTED }}>Create a project, then begin its Speedpanel estimate.</div>
          </div>
          <ChevronDown size={18} className="shrink-0 -rotate-90" style={{ color: MUTED }} />
        </button>
      );
    }
    return (
      <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>New Project</Button>
    );
  }

  return (
    <form onSubmit={handleCreate} className={`${cx.card} mt-3 flex flex-col gap-3`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project name" value={name} onChange={setName} required />
        <Field label="Project reference" value={reference} onChange={setReference} />
        <Field label="Site address" value={siteAddress} onChange={setSiteAddress} />
        <Field label="Customer or company" value={customerName} onChange={setCustomerName} />
        <div className="sm:col-span-2"><TextAreaField label="Description" value={description} onChange={setDescription} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={creating || !name.trim()} className="h-[46px] shrink-0">
          {creating ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="secondary" className="h-[46px] shrink-0" onClick={() => { setOpen(false); setError(null); reset(); }}>
          Cancel
        </Button>
      </div>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-300">{error}</p>}
    </form>
  );
};

const ProjectPhoneCard = ({ item, journey, companyName, onOpen }: {
  item: ProjectRow; journey: ProjectJourneyInfo | undefined; companyName: string | undefined; onOpen: () => void;
}) => {
  const stage = journey?.journey.stage ?? "estimating";
  const progress = journey?.progress ?? 0;
  const phoneStats = useProjectPhoneStats(item);
  const ctaLabel = item.stage === "draft" ? "Continue Estimate" : "Open Estimate";

  return (
    <button onClick={onOpen} className={`${cx.card} mt-3 block w-full text-left`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
          <div className="text-xs" style={{ color: MUTED }}>Ref: {item.data.reference || item.id.slice(0, 8).toUpperCase()}{companyName ? ` · ${companyName}` : ""}</div>
        </div>
        <span className={`${cx.badge} shrink-0 ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>{JOURNEY_STAGE_LABELS[stage]}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Stat value={phoneStats.wallCount} label="Walls" />
        <Stat value={`${r1(phoneStats.area)} m²`} label="Area" />
        <Stat value={phoneStats.panels} label="Panels" />
      </div>
      {phoneStats.warnings > 0 && (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-xs" style={{ color: MUTED }}>
          <span>{Math.round(progress)}% complete</span>
          <span className={`${cx.badge} ${tone("danger")}`}>{phoneStats.warnings} warning{phoneStats.warnings !== 1 ? "s" : ""}</span>
        </div>
      )}
      <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/55 py-2.5 text-sm font-bold" style={{ color: BLUE }}>
        {ctaLabel}
      </div>
    </button>
  );
};

const journeySteps = JOURNEY_STAGES.map(s => ({ label: JOURNEY_STAGE_LABELS[s] }));

export const ProjectsListPage = ({ user, onOpenProject, layoutMode, hasCompany, activeCompanyId, onTeam }: {
  user: User | null; onOpenProject: (id: string) => void; layoutMode: EffectiveLayout;
  hasCompany: boolean; activeCompanyId: string | null; onTeam: () => void;
}) => {
  const { projects, loading, error, reload, createProject } = useProjects(user, activeCompanyId);
  const { ordersByStage, ordersTotal, totalValue, loading: ordersLoading } = useOrdersSummary(user);
  const { byProject: journeyByProject, loading: journeyLoading } = useProjectsJourney(user, projects);
  const companyNames = useProjectCompanyNames(useMemo(() => [...new Set(projects.map(p => p.company_id).filter((id): id is string => !!id))], [projects]));

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | JourneyStage>("all");

  const journeyCounts = useMemo(() => {
    const counts = Object.fromEntries(JOURNEY_STAGES.map(s => [s, 0])) as Record<JourneyStage, number>;
    for (const p of projects) counts[journeyByProject.get(p.id)?.journey.stage ?? "estimating"]++;
    return counts;
  }, [projects, journeyByProject]);

  const filtered = useMemo(() => projects.filter(p => {
    if (activeTab !== "all" && (journeyByProject.get(p.id)?.journey.stage ?? "estimating") !== activeTab) return false;
    if (!query.trim()) return true;
    const company = companyNames.get(p.company_id ?? "") ?? "";
    return [p.name, p.id, company].join(" ").toLowerCase().includes(query.toLowerCase());
  }), [projects, activeTab, query, journeyByProject, companyNames]);

  const projectsByStage = useMemo(
    () => Object.fromEntries(STAGES.map(s => [s, projects.filter(p => p.stage === s).length])) as Record<typeof STAGES[number], number>,
    [projects],
  );

  const columns: TableColumn<ProjectRow>[] = useMemo(() => [
    {
      key: "project", header: "Project",
      cell: item => {
        const stage = journeyByProject.get(item.id)?.journey.stage ?? "estimating";
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/55">
              <Building2 size={18} style={{ color: BLUE }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</p>
              <p className="mt-0.5 text-xs" style={{ color: MUTED }}>Ref: {item.data.reference || item.id.slice(0, 8).toUpperCase()}</p>
              <div className="mt-1.5">
                <StepTracker steps={journeySteps} activeIndex={JOURNEY_STAGES.indexOf(stage)} layoutMode={layoutMode} size="compact" />
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: "stage", header: "Stage",
      cell: item => {
        const stage = journeyByProject.get(item.id)?.journey.stage ?? "estimating";
        return <span className={`${cx.badge} ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>{JOURNEY_STAGE_LABELS[stage]}</span>;
      },
    },
    {
      key: "company", header: "Company",
      cell: item => {
        const name = companyNames.get(item.company_id ?? "");
        return <span className="text-sm" style={{ color: name ? NAVY : MUTED }}>{name ?? "—"}</span>;
      },
    },
    {
      key: "milestone", header: "Next Milestone",
      cell: item => {
        const journey = journeyByProject.get(item.id);
        const stage = journey?.journey.stage ?? "estimating";
        const milestone = journeyMilestone(stage, {
          estimatingNote: journey?.journey.estimatingNote,
          estCompletion: journey?.representativeOrder?.manufacturing_est_completion,
          nextDeliveryDate: journey ? nextDeliveryDate(journey.representativeDeliveries) : null,
        });
        const MilestoneIcon = milestoneIcon(stage);
        return (
          <div className="flex items-center gap-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>
              <MilestoneIcon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: NAVY }}>{milestone.label}</p>
              <p className="mt-0.5 truncate text-xs" style={{ color: MUTED }}>{milestone.note}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "updated", header: "Last Updated", align: "right",
      cell: item => (
        <div className="text-sm" style={{ color: NAVY }}>
          <p>{relativeTime(item.updated_at)}</p>
          <p className="mt-0.5 text-xs" style={{ color: MUTED }}>{new Date(item.updated_at).toLocaleDateString()}</p>
        </div>
      ),
    },
  ], [journeyByProject, companyNames, layoutMode]);

  return (
    <div className="mt-2">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className={cx.h1}>All Projects</h1>
          </div>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>Track the status of all your projects in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasCompany && <button onClick={onTeam} className="text-sm font-bold" style={{ color: BLUE }}>Team &rarr;</button>}
          <NewProjectPanel layoutMode={layoutMode} onCreate={async (name, meta) => { const { id, error: err } = await createProject(name, meta); if (id) onOpenProject(id); return err; }} />
        </div>
      </div>

      <label className="mt-4 flex h-10 max-w-sm items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 shadow-sm">
        <Search className="h-4 w-4" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" style={{ color: NAVY }} />
      </label>

      <div className={`mt-4 ${cx.tabList}`}>
        <button onClick={() => setActiveTab("all")} className={`${activeTab === "all" ? cx.tabActive : cx.tabInactive} inline-flex items-center gap-2`}>
          All Projects
          <span className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-slate-500 dark:bg-slate-700 dark:text-slate-300">{projects.length}</span>
        </button>
        {JOURNEY_STAGES.map(s => (
          <button key={s} onClick={() => setActiveTab(s)} className={`${activeTab === s ? cx.tabActive : cx.tabInactive} inline-flex items-center gap-2`}>
            {JOURNEY_STAGE_LABELS[s]}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal ${JOURNEY_STAGE_BADGE_CLASS[s]}`}>{journeyCounts[s]}</span>
          </button>
        ))}
      </div>

      {(loading || journeyLoading) && <LoadingState className="mt-3" label="Loading projects" />}

      {!loading && error && (
        <ErrorState className="mt-3" message={error} onRetry={() => reload()} />
      )}

      {!loading && !error && projects.length === 0 && (
        <EmptyState className="mt-3" message="No projects yet -- create one above to get started." />
      )}

      {!loading && !error && projects.length > 0 && (
        layoutMode === "phone" ? (
          <div>
            {filtered.map(item => (
              <ProjectPhoneCard key={item.id} item={item} journey={journeyByProject.get(item.id)}
                companyName={companyNames.get(item.company_id ?? "")} onOpen={() => onOpenProject(item.id)} />
            ))}
            {filtered.length === 0 && <EmptyState className="mt-3" message="No projects match your search." />}
          </div>
        ) : (
          <>
            <Table className="mt-3" columns={columns} rows={filtered} rowKey={item => item.id} onRowClick={item => onOpenProject(item.id)} />
            {filtered.length === 0 && <EmptyState className="mt-3" message="No projects match your search." />}
          </>
        )
      )}

      {!loading && !error && (
        <p className="mt-3 text-sm" style={{ color: MUTED }}>Showing {filtered.length} of {projects.length} projects</p>
      )}

      <div className={cx.cardHd + " mt-8"}>Projects</div>
      <StatsGrid stats={[
        { value: projects.length, label: "Total" },
        ...STAGES.map(s => ({ value: projectsByStage[s], label: STAGE_LABELS[s] })),
      ]} />

      <div className={cx.cardHd + " mt-5"}>Orders</div>
      <StatsGrid stats={[
        { value: ordersLoading ? "--" : ordersTotal, label: "Total" },
        ...ORDER_STAGES.map(s => ({ value: ordersLoading ? "--" : ordersByStage[s], label: ORDER_STAGE_LABELS[s] })),
        { value: ordersLoading ? "--" : `$${totalValue.toFixed(0)}`, label: "Total value" },
      ]} />
    </div>
  );
};
