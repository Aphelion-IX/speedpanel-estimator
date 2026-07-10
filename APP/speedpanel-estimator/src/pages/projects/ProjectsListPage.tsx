// =============================================================================
// Projects
// =============================================================================
// One page, not a list page + a separate detail page: the "My Projects"
// carousel up top, and directly below it the full ProjectDashboard.tsx for
// whichever project is selected -- defaulting to the most recently updated
// one (projects are already fetched sorted by updated_at desc, so
// projects[0] already IS "most recent", no extra query needed) when no id
// is in the URL. Clicking a different carousel card calls onSelect, which
// navigates to #/projects/:id -- selection is URL-driven (shareable/
// refreshable), not local-only state, same as every other sub-view in this
// app. See ProjectsRouter.tsx for how route.id flows into selectedId here.
//
// "New project" creation lives at the end of the carousel as a dashed
// "+ New Project" card -- same dashed-border "+Add" treatment as
// ui/wallsCard.tsx's wall-tab strip, with the same inline-name-prompt-on-
// click pattern already built for systemSelector/WallSystemOptionCard.tsx's
// "Select System" flow. No new interaction pattern invented.
//
// The "Projects"/"Orders" aggregate Stat rows (project stage counts, orders
// stage counts + total value) sit at the very bottom -- useful "whole sales
// process" totals, but not part of the primary carousel+dashboard view, so
// they don't compete with it for top-of-page attention.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Building2, Plus } from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { Stat } from "../../ui/primitives";
import type { EffectiveLayout } from "../../useLayoutMode";
import { useProjects } from "./projectsStore";
import { useOrdersSummary } from "./dashboardStore";
import { ProjectDashboard } from "./ProjectDashboard";
import { STAGES, STAGE_LABELS, PROJECT_STAGE_BADGE_CLASS } from "./projectTypes";
import { ORDER_STAGES, ORDER_STAGE_LABELS } from "./orders/orderTypes";
import type { ProjectRow } from "./projectTypes";

const stageProgress = (stage: ProjectRow["stage"]): number => STAGES.indexOf(stage) / (STAGES.length - 1) * 100;

const ProjectCard = ({ item, selected, onSelect }: { item: ProjectRow; selected: boolean; onSelect: (id: string) => void }) => (
  <button onClick={() => onSelect(item.id)}
    className="shrink-0 w-64 rounded-xl border-2 bg-white dark:bg-slate-800 px-3.5 py-3.5 text-left transition-shadow hover:shadow-md"
    style={selected ? { borderColor: BLUE } : { borderColor: "transparent" }}>
    <div className="flex items-start gap-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
        <Building2 size={16} style={{ color: BLUE }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
        <span className={`${cx.badge} mt-1 inline-block ${PROJECT_STAGE_BADGE_CLASS[item.stage]}`}>{STAGE_LABELS[item.stage]}</span>
      </div>
    </div>
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div className="h-full rounded-full transition-all" style={{ width: `${stageProgress(item.stage)}%`, background: BLUE }} />
    </div>
    <p className="mt-2 text-xs" style={{ color: MUTED }}>Last updated {new Date(item.updated_at).toLocaleDateString()}</p>
  </button>
);

const NewProjectCard = ({ onCreate }: { onCreate: (name: string) => Promise<string | null> }) => {
  const [naming, setNaming] = useState(false);
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
    if (err) setError(err);
  };

  if (naming) {
    return (
      <form onSubmit={handleCreate} className="shrink-0 w-64 rounded-xl border-2 border-dashed px-3.5 py-3.5" style={{ borderColor: BLUE }}>
        <Field label="Project name" value={name} onChange={setName} required />
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="submit" disabled={creating || !name.trim()}
            className="flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            {creating ? "Creating..." : "Create"}
          </button>
          <button type="button" onClick={() => { setNaming(false); setError(null); }} className="rounded-xl px-3 text-sm font-semibold" style={{ color: MUTED }}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button onClick={() => setNaming(true)}
      className="shrink-0 grid w-64 place-items-center rounded-xl border-2 border-dashed px-3.5 py-3.5 active:scale-95 transition-all bg-white dark:bg-slate-800"
      style={{ borderColor: BLUE, minHeight: 116 }}>
      <div className="flex items-center gap-1.5">
        <Plus size={16} style={{ color: BLUE }} />
        <span className="text-sm font-bold" style={{ color: BLUE }}>New Project</span>
      </div>
    </button>
  );
};

export const ProjectsListPage = ({ user, selectedId, onSelect, onOpenEstimator, onRequestQuote, onCreateOrder, onOpenOrder, layoutMode }: {
  user: User | null; selectedId?: string; onSelect: (id: string) => void;
  onOpenEstimator: (project: ProjectRow) => void; onRequestQuote: (id: string) => void;
  onCreateOrder: (id: string) => void; onOpenOrder: (id: string, orderId: string) => void;
  layoutMode: EffectiveLayout;
}) => {
  const { projects, loading, error, reload, createProject } = useProjects(user);
  const { ordersByStage, ordersTotal, totalValue, loading: ordersLoading } = useOrdersSummary(user);

  const projectsByStage = useMemo(
    () => Object.fromEntries(STAGES.map(s => [s, projects.filter(p => p.stage === s).length])) as Record<typeof STAGES[number], number>,
    [projects],
  );

  const effectiveId = selectedId ?? projects[0]?.id;

  const handleCreate = async (name: string): Promise<string | null> => {
    const { id, error: err } = await createProject(name);
    if (err) return err;
    if (id) onSelect(id);
    return null;
  };

  return (
    <div className="mt-2">
      <h1 className="text-2xl font-bold" style={{ color: NAVY }}>My Projects</h1>

      {loading && <div className={`${cx.card} mt-3 text-sm`} style={{ color: MUTED }}>Loading...</div>}

      {!loading && error && (
        <div className={`${cx.card} mt-3`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {projects.map(item => <ProjectCard key={item.id} item={item} selected={item.id === effectiveId} onSelect={onSelect} />)}
          <NewProjectCard onCreate={handleCreate} />
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <p className={cx.footnote}>No projects yet -- create one above to get started.</p>
      )}

      {!loading && !error && effectiveId && (
        <ProjectDashboard id={effectiveId} onOpenEstimator={onOpenEstimator} onRequestQuote={onRequestQuote}
          onCreateOrder={onCreateOrder} onOpenOrder={onOpenOrder} layoutMode={layoutMode} />
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
