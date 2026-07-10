// =============================================================================
// Projects list
// =============================================================================
// The signed-in user's saved projects: name it, save it, reopen it. Loading/
// error/empty/list cascade mirrors admin/AdminRequestsPage.tsx's shape. "New
// project" is a simple inline name field + Create button -- no modal, same
// "plain page, not a dialog" convention SignInGate.tsx follows.
//
// Dashboard: the two stat rows above the list ("Projects"/"Orders") give a
// single master view across the whole sales process -- project stage counts
// tallied client-side from the same `projects` array already fetched below
// (no extra query), orders stage counts + total value from dashboardStore.ts's
// useOrdersSummary (a direct owner_id-scoped query, no join through
// project_id needed -- see that file's header comment). Built from the same
// Stat-tile-grid pattern as admin/AdminAnalyticsPage.tsx, the one existing
// dashboard-style page in this codebase, for visual consistency.
//
// The project list itself (now under "Current Projects") is a horizontal
// scroll strip -- same flex/overflow-x-auto pattern as
// education/RecentlyViewedStrip.tsx, this app's one existing "strip of
// cards" idiom, rather than a new carousel component/library. Each card's
// progress bar is a real, honest proxy (STAGES.indexOf(stage) / last index),
// not an invented number -- there's no manufacturing/delivery tracking to
// show yet (see ProjectDetailPage.tsx's header comment for what's explicitly
// deferred). Clicking a card still opens the same, unchanged ProjectDetailPage
// "project journey" view.
// =============================================================================
import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Building2 } from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { Stat } from "../../ui/primitives";
import { useProjects } from "./projectsStore";
import { useOrdersSummary } from "./dashboardStore";
import { STAGES, STAGE_LABELS, PROJECT_STAGE_BADGE_CLASS } from "./projectTypes";
import { ORDER_STAGES, ORDER_STAGE_LABELS } from "./orders/orderTypes";
import type { ProjectRow } from "./projectTypes";

const stageProgress = (stage: ProjectRow["stage"]): number => STAGES.indexOf(stage) / (STAGES.length - 1) * 100;

const ProjectCard = ({ item, onOpen }: { item: ProjectRow; onOpen: (id: string) => void }) => (
  <button onClick={() => onOpen(item.id)}
    className="shrink-0 w-64 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3.5 text-left transition-shadow hover:shadow-md">
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

export const ProjectsListPage = ({ user, onOpen }: { user: User | null; onOpen: (id: string) => void }) => {
  const { projects, loading, error, reload, createProject } = useProjects(user);
  const { ordersByStage, ordersTotal, totalValue, loading: ordersLoading } = useOrdersSummary(user);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const projectsByStage = useMemo(
    () => Object.fromEntries(STAGES.map(s => [s, projects.filter(p => p.stage === s).length])) as Record<typeof STAGES[number], number>,
    [projects],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { id, error: err } = await createProject(name.trim());
    setCreating(false);
    if (err) { setCreateError(err); return; }
    setName("");
    if (id) onOpen(id);
  };

  return (
    <div className="mt-2">
      <div className={cx.cardHd}>Projects</div>
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

      <div className={`${cx.card} mt-5`}>
        <h1 className="text-sm font-bold" style={{ color: NAVY }}>New project</h1>
        <form onSubmit={handleCreate} className="mt-3 flex items-end gap-2">
          <div className="flex-1"><Field label="Project name" value={name} onChange={setName} required /></div>
          <button type="submit" disabled={creating || !name.trim()}
            className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
        {createError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>}
      </div>

      <div className={cx.cardHd + " mt-5"}>Current Projects</div>

      {loading && <div className={`${cx.card} mt-3 text-sm`} style={{ color: MUTED }}>Loading...</div>}

      {!loading && error && (
        <div className={`${cx.card} mt-3`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className={`${cx.card} mt-3 text-center`}>
          <p className={cx.footnote} style={{ paddingTop: 0 }}>No projects yet -- create one above to get started.</p>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {projects.map(item => <ProjectCard key={item.id} item={item} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
};
