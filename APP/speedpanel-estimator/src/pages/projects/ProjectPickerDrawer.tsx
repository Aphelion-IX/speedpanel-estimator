// =============================================================================
// Project picker -- "choose a project first" step for cross-project actions
// =============================================================================
// Spec section 6 (Quick Order): "Ask the customer to select a project first.
// Support recent projects, search, active projects and Create New Project."
// Reused by both the All Projects "Quick Order" and "Request Pre-Start
// Meeting" quick actions (see ProjectsListPage.tsx) -- neither needs its own
// copy of the same search-a-project list.
// =============================================================================
import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import { Drawer } from "../../ui/drawer";
import { EmptyState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import type { ProjectRow } from "./projectTypes";

export const ProjectPickerDrawer = ({ title, projects, layoutMode, onPick, onClose }: {
  title: string; projects: ProjectRow[]; layoutMode: EffectiveLayout;
  onPick: (project: ProjectRow) => void; onClose: () => void;
}) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const recent = [...projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (!q) return recent.slice(0, 25);
    return recent.filter(p => [p.name, p.data.siteAddress ?? "", p.builder_name ?? "", p.project_number ?? ""].join(" ").toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <Drawer open onClose={onClose} layoutMode={layoutMode} title={title}>
      <label className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 shadow-sm">
        <Search className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" style={{ color: NAVY }} />
      </label>

      {filtered.length === 0 ? (
        <EmptyState className="mt-3" message="No projects match your search." />
      ) : (
        <div className="mt-3 space-y-1.5">
          {filtered.map(p => (
            <button key={p.id} onClick={() => onPick(p)} className={`${cx.card} flex w-full items-center gap-3 p-3 text-left`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/55" style={{ color: NAVY }}>
                <Building2 size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold" style={{ color: NAVY }}>{p.name}</p>
                <p className="truncate text-xs" style={{ color: MUTED }}>{p.data.siteAddress || p.project_number || p.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
};
