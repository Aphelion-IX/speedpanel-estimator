// =============================================================================
// Projects list
// =============================================================================
// The signed-in user's saved projects: name it, save it, reopen it. Loading/
// error/empty/list cascade mirrors admin/AdminRequestsPage.tsx's shape. "New
// project" is a simple inline name field + Create button -- no modal, same
// "plain page, not a dialog" convention SignInGate.tsx follows.
// =============================================================================
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { useProjects } from "./projectsStore";
import { STAGE_LABELS } from "./projectTypes";
import type { ProjectRow } from "./projectTypes";

const ProjectCard = ({ item, onOpen }: { item: ProjectRow; onOpen: (id: string) => void }) => (
  <button onClick={() => onOpen(item.id)} className={`${cx.card} mt-3 w-full text-left transition-shadow hover:shadow-md`}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide" style={{ background: BLUE, color: WHITE }}>
        {STAGE_LABELS[item.stage]}
      </span>
    </div>
    <p className="mt-1 text-xs" style={{ color: MUTED }}>Last updated {new Date(item.updated_at).toLocaleString()}</p>
  </button>
);

export const ProjectsListPage = ({ user, onOpen }: { user: User | null; onOpen: (id: string) => void }) => {
  const { projects, loading, error, reload, createProject } = useProjects(user);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      <div className={cx.card}>
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

      {!loading && !error && projects.map(item => <ProjectCard key={item.id} item={item} onOpen={onOpen} />)}
    </div>
  );
};
