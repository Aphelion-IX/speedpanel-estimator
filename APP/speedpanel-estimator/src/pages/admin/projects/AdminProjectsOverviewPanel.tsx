// =============================================================================
// Projects Administration -- Overview
// =============================================================================
// Real, server-computed stats (admin_projects_dashboard_stats/
// admin_projects_requiring_action, supabase/schema.sql) -- no client-side
// aggregation, no placeholder numbers.
// =============================================================================
import { AlertTriangle, LayoutDashboard } from "lucide-react";
import { cx, NAVY, MUTED, tone } from "../../../styleTokens";
import { Card } from "../../../ui/primitives";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { useAdminProjectsDashboard } from "./adminProjectsAdminStore";
import { SERVICE_REQUEST_TYPE_LABELS, type ServiceRequestType } from "../../projects/services/serviceRequestTypes";

const STAT_LABELS: { key: "activeProjects" | "unassigned" | "completionBlocked" | "openServices"; label: string }[] = [
  { key: "activeProjects", label: "Active Projects" },
  { key: "unassigned", label: "Unassigned" },
  { key: "completionBlocked", label: "Completion Blocked" },
  { key: "openServices", label: "Open Services" },
];

export const AdminProjectsOverviewPanel = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
  const { stats, requiringAction, loading, error, reload } = useAdminProjectsDashboard();

  if (loading) return <LoadingState className="mt-4" label="Loading projects overview" />;
  if (error || !stats) return <ErrorState className="mt-4" message={error || "Could not load overview."} onRetry={() => reload()} />;

  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_LABELS.map(s => (
          <div key={s.key} className={`${cx.card} text-center`}>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{s.label}</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>{stats[s.key]}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Projects Requiring Action" icon={<AlertTriangle size={14} />}>
          {requiringAction.length === 0 ? (
            <EmptyState message="Nothing needs attention right now." />
          ) : (
            <div className="space-y-2">
              {requiringAction.map(p => (
                <button key={p.id} onClick={() => onOpenProject(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-left hover:border-blue-300">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>{p.name}</p>
                    <p className={cx.footnote} style={{ paddingTop: 0 }}>{p.project_number || "—"} &middot; {p.project_manager_name || "Unassigned"}</p>
                  </div>
                  <span className={`${cx.badge} ${tone("danger")}`}>{p.reason}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Service Workload" icon={<LayoutDashboard size={14} />}>
          {Object.keys(stats.serviceWorkload).length === 0 ? (
            <EmptyState message="No open service requests." />
          ) : (
            <div className="space-y-2">
              {Object.entries(stats.serviceWorkload).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2">
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>
                    {SERVICE_REQUEST_TYPE_LABELS[type as ServiceRequestType] ?? type}
                  </span>
                  <span className={`${cx.badge} ${tone("info")}`}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
