// =============================================================================
// Projects -- list/overview page
// =============================================================================
// Modeled on the supplied ProjectsPage.tsx mockup: search, real journey-stage
// count tabs, and a table (web) / stacked cards (phone) of every project a
// row click navigates to that project's own ProjectDetailPage.tsx (see
// ProjectsRouter.tsx -- #/projects and #/projects/:id are now two distinct
// views, not one page with an embedded dashboard). "+ New Project" is the
// mockup's one missing-but-required piece of real functionality -- reused
// verbatim from the old carousel's inline-name-field creation flow
// (projectsStore.ts's createProject()), just relocated into the header row.
//
// Journey stage (the mockup's 8-step Estimating..Completed pipeline) is a
// DISPLAY-ONLY value computed by journeyStage.ts from each project's real
// orders/manufacturing/delivery data -- see that file's header comment for
// why it's never a persisted column. The bottom Projects/Orders Stat rows
// deliberately keep showing the REAL project.stage (draft/install_review/
// technical_review/approved) and order.stage pipelines untouched -- the new
// journey tabs above are an additional, honest view, not a replacement for
// those existing aggregate totals.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Building2, Check, FileText, Plus, Search, Settings, Truck } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { Stat } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProjects, useProjectCompanyNames } from "./projectsStore";
import { useOrdersSummary } from "./dashboardStore";
import { useProjectsJourney, type ProjectJourneyInfo } from "./projectsJourneyStore";
import { journeyMilestone, nextDeliveryDate } from "./journeyCopy";
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

const NewProjectPanel = ({ onCreate }: { onCreate: (name: string) => Promise<string | null> }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const err = await onCreate(name.trim());
    setCreating(false);
    if (err) { setError(err); return; }
    setOpen(false);
    setName("");
  };

  if (!open) {
    return (
      <Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>New Project</Button>
    );
  }

  return (
    <form onSubmit={handleCreate} className={`${cx.card} mt-3 flex flex-wrap items-end gap-2`}>
      <div className="min-w-[220px] flex-1"><Field label="Project name" value={name} onChange={setName} required /></div>
      <Button type="submit" disabled={creating || !name.trim()} className="h-[46px] shrink-0">
        {creating ? "Creating..." : "Create"}
      </Button>
      <Button type="button" variant="secondary" className="h-[46px] shrink-0" onClick={() => { setOpen(false); setError(null); }}>
        Cancel
      </Button>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
};

// Compact per-row 8-dot timeline (web only) -- a smaller, label-light
// sibling of ProjectJourneyTimeline.tsx's own web variant, matching the
// mockup's row-level StageTimeline density (a table row has no room for
// full h-14 icon circles + captions).
const ListRowTimeline = ({ stage }: { stage: JourneyStage }) => {
  const activeIndex = JOURNEY_STAGES.indexOf(stage);
  return (
    <div className="min-w-[420px]">
      <div className="relative grid grid-cols-8">
        <div className="absolute left-[6%] right-[6%] top-3 h-px bg-slate-200 dark:bg-slate-700" />
        <div className="absolute left-[6%] top-3 h-px bg-emerald-400" style={{ width: `${Math.max(0, (activeIndex / (JOURNEY_STAGES.length - 1)) * 88)}%` }} />
        {JOURNEY_STAGES.map((s, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <div key={s} className="relative z-10 text-center">
              <div className={[
                "mx-auto grid h-6 w-6 place-items-center rounded-full border bg-white dark:bg-slate-800",
                done && "border-emerald-500 bg-emerald-500 text-white",
                current && "border-blue-600 text-blue-700 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-900/40",
                !done && !current && "border-slate-200 dark:border-slate-700",
              ].filter(Boolean).join(" ")}>
                {done && <Check className="h-3 w-3" />}
              </div>
              <p className={`mt-1.5 px-0.5 text-[9px] leading-3 ${current ? "font-semibold text-blue-700 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}>
                {JOURNEY_STAGE_LABELS[s]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProjectListRow = ({ item, journey, companyName, onOpen, layoutMode }: {
  item: ProjectRow; journey: ProjectJourneyInfo | undefined; companyName: string | undefined;
  onOpen: () => void; layoutMode: EffectiveLayout;
}) => {
  const stage = journey?.journey.stage ?? "estimating";
  const progress = journey?.progress ?? 0;
  const milestone = journeyMilestone(stage, {
    estimatingNote: journey?.journey.estimatingNote,
    estCompletion: journey?.representativeOrder?.manufacturing_est_completion,
    nextDeliveryDate: journey ? nextDeliveryDate(journey.representativeDeliveries) : null,
  });
  const MilestoneIcon = milestoneIcon(stage);

  if (layoutMode === "phone") {
    return (
      <button onClick={onOpen} className={`${cx.card} mt-3 block w-full text-left`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
            <div className="text-xs" style={{ color: MUTED }}>Ref: {item.id.slice(0, 8).toUpperCase()}{companyName ? ` · ${companyName}` : ""}</div>
          </div>
          <span className={`${cx.badge} shrink-0 ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>{JOURNEY_STAGE_LABELS[stage]}</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: BLUE }} />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
          <MilestoneIcon size={12} />{milestone.label} &middot; {milestone.note}
        </div>
      </button>
    );
  }

  return (
    <article onClick={onOpen}
      className="grid cursor-pointer gap-5 border-b border-slate-100 dark:border-slate-800 p-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40 last:border-b-0 xl:grid-cols-[2.3fr_3.2fr_.9fr_1.25fr_.85fr] xl:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
          <Building2 size={22} style={{ color: BLUE }} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</h3>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>Ref: {item.id.slice(0, 8).toUpperCase()}</p>
          {companyName && (
            <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm" style={{ color: MUTED }}>
              <Building2 className="h-3.5 w-3.5" />{companyName}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto"><ListRowTimeline stage={stage} /></div>

      <div>
        <p className="text-xl font-extrabold" style={{ color: progress === 100 ? "#059669" : BLUE }}>{progress}%</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: progress === 100 ? "#10b981" : BLUE }} />
        </div>
        <p className="mt-2 text-xs" style={{ color: MUTED }}>{JOURNEY_STAGE_LABELS[stage]}</p>
      </div>

      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${JOURNEY_STAGE_BADGE_CLASS[stage]}`}>
          <MilestoneIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: NAVY }}>{milestone.label}</p>
          <p className="mt-1 truncate text-xs" style={{ color: MUTED }}>{milestone.note}</p>
        </div>
      </div>

      <div className="text-sm" style={{ color: NAVY }}>
        <p>{relativeTime(item.updated_at)}</p>
        <p className="mt-1 text-xs" style={{ color: MUTED }}>{new Date(item.updated_at).toLocaleDateString()}</p>
      </div>
    </article>
  );
};

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
          <NewProjectPanel onCreate={async name => { const { id, error: err } = await createProject(name); if (id) onOpenProject(id); return err; }} />
        </div>
      </div>

      <label className="mt-4 flex h-10 max-w-sm items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 shadow-sm">
        <Search className="h-4 w-4" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" style={{ color: NAVY }} />
      </label>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab("all")}
          className={`flex shrink-0 items-center gap-3 rounded-lg border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold shadow-sm ${activeTab === "all" ? "border-blue-200 dark:border-blue-800" : "border-slate-200 dark:border-slate-700"}`}
          style={{ color: NAVY }}>
          All Projects
          <span className="grid min-w-6 place-items-center rounded-full bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs" style={{ color: MUTED }}>{projects.length}</span>
        </button>
        {JOURNEY_STAGES.map(s => (
          <button key={s} onClick={() => setActiveTab(s)}
            className={`flex shrink-0 items-center gap-3 rounded-lg border bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold shadow-sm ${activeTab === s ? "border-blue-200 dark:border-blue-800" : "border-slate-200 dark:border-slate-700"}`}
            style={{ color: NAVY }}>
            {JOURNEY_STAGE_LABELS[s]}
            <span className={`grid min-w-6 place-items-center rounded-full px-1.5 py-0.5 text-xs ${JOURNEY_STAGE_BADGE_CLASS[s]}`}>{journeyCounts[s]}</span>
          </button>
        ))}
      </div>

      {(loading || journeyLoading) && <LoadingState className="mt-3" label="Loading projects" />}

      {!loading && error && (
        <ErrorState className="mt-3" message={error} onRetry={() => reload()} />
      )}

      {!loading && !error && projects.length === 0 && (
        <p className={cx.footnote}>No projects yet -- create one above to get started.</p>
      )}

      {!loading && !error && projects.length > 0 && (
        layoutMode === "phone" ? (
          <div>
            {filtered.map(item => (
              <ProjectListRow key={item.id} item={item} journey={journeyByProject.get(item.id)}
                companyName={companyNames.get(item.company_id ?? "")} onOpen={() => onOpenProject(item.id)} layoutMode={layoutMode} />
            ))}
            {filtered.length === 0 && <p className={cx.footnote}>No projects match your search.</p>}
          </div>
        ) : (
          <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <div className="hidden grid-cols-[2.3fr_3.2fr_.9fr_1.25fr_.85fr] border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 px-4 py-3 text-[11px] font-bold uppercase tracking-wide xl:grid" style={{ color: MUTED }}>
              <div>Project</div><div>Stage</div><div>Progress</div><div>Next Milestone</div><div>Last Updated</div>
            </div>
            {filtered.map(item => (
              <ProjectListRow key={item.id} item={item} journey={journeyByProject.get(item.id)}
                companyName={companyNames.get(item.company_id ?? "")} onOpen={() => onOpenProject(item.id)} layoutMode={layoutMode} />
            ))}
            {filtered.length === 0 && <p className={`${cx.footnote} p-4`}>No projects match your search.</p>}
          </section>
        )
      )}

      {!loading && !error && (
        <p className="mt-3 text-sm" style={{ color: MUTED }}>Showing {filtered.length} of {projects.length} projects</p>
      )}

      <div className={cx.cardHd + " mt-8"}>Projects</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat value={projects.length} label="Total" />
        {STAGES.map(s => <Stat key={s} value={projectsByStage[s]} label={STAGE_LABELS[s]} />)}
      </div>

      <div className={cx.cardHd + " mt-5"}>Orders</div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        <Stat value={ordersLoading ? "--" : ordersTotal} label="Total" />
        {ORDER_STAGES.map(s => <Stat key={s} value={ordersLoading ? "--" : ordersByStage[s]} label={ORDER_STAGE_LABELS[s]} />)}
        <Stat value={ordersLoading ? "--" : `$${totalValue.toFixed(0)}`} label="Total value" />
      </div>
    </div>
  );
};
