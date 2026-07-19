// =============================================================================
// Order entry -- top-level "place an order" shortcut
// =============================================================================
// Orders always belong to a project (orders.project_id is not null, see
// supabase/schema.sql), so this isn't a standalone order form -- it's a
// lightweight project picker that hands off into the existing project-scoped
// Quick Order flow (QuickOrderPage.tsx, reached today only from a project's
// own detail page) once a project is chosen. Reuses useProjects the same way
// ProjectsListPage.tsx does, just without that page's filters/search/stage
// grouping -- this is meant to be a fast "pick a project, start ordering"
// step, not a full project browser.
// =============================================================================
import { ChevronRight, ShoppingCart } from "lucide-react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import type { UseAuth } from "../../lib/useAuth";
import { useProjects } from "../projects/projectsStore";

export const OrderEntryPage = ({ auth, activeCompanyId, onPickProject, onGoToProjects }: {
  auth: UseAuth; activeCompanyId: string | null;
  onPickProject: (projectId: string) => void;
  onGoToProjects: () => void;
}) => {
  const { projects, loading, error, reload } = useProjects(auth.user, activeCompanyId);

  return (
    <div className="mt-2">
      <h1 className={cx.h1}>Place an order</h1>
      <p className={cx.footnote}>Pick a project to add products to, without using the Estimator.</p>

      {loading && <LoadingState className="mt-6" label="Loading your projects" />}
      {!loading && error && <ErrorState className="mt-6" message={error} onRetry={reload} />}

      {!loading && !error && projects.length === 0 && (
        <div className="mt-6">
          <EmptyState message="You don't have any projects yet -- create one first, then come back here to order against it." />
          <button onClick={onGoToProjects} className="mt-3 text-sm font-bold hover:underline" style={{ color: BLUE }}>
            Go to Projects &rarr;
          </button>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="mt-4 space-y-2">
          {projects.map(p => (
            <button key={p.id} onClick={() => onPickProject(p.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3.5 text-left transition hover:border-blue-300 dark:hover:border-blue-500/50`}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 dark:bg-blue-900/55">
                  <ShoppingCart size={16} style={{ color: BLUE }} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: NAVY }}>{p.name}</p>
                  <p className="mt-0.5 text-xs" style={{ color: MUTED }}>Updated {new Date(p.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: BLUE }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
