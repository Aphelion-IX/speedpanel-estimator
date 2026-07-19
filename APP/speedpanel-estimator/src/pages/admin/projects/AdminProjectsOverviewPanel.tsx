// =============================================================================
// Projects Administration -- Overview
// =============================================================================
// Real, server-computed stats (admin_projects_dashboard_stats/
// admin_projects_requiring_action, supabase/schema.sql) -- no client-side
// aggregation, no placeholder numbers. Styled with projectsAdminTheme.css's
// pa-* classes to match UI-DESIGNS/internal/projects-backend-dashboard.html
// exactly (see AdminProjectsAdministrationPage.tsx for the theme scope).
// =============================================================================
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
    <>
      <div className="pa-summary">
        {STAT_LABELS.map(s => (
          <div key={s.key}><span>{s.label}</span><strong>{stats[s.key]}</strong></div>
        ))}
      </div>

      <div className="pa-grid">
        <section className="pa-card">
          <div className="pa-section-head">
            <div><h2>Projects Requiring Action</h2><p>Highest priority administration items</p></div>
          </div>
          {requiringAction.length === 0 ? (
            <EmptyState message="Nothing needs attention right now." />
          ) : (
            <div className="pa-table-wrap">
              <table className="pa-table">
                <thead><tr><th>Project</th><th>Issue</th><th>Owner</th><th></th></tr></thead>
                <tbody>
                  {requiringAction.map(p => (
                    <tr key={p.id} onClick={() => onOpenProject(p.id)}>
                      <td>{p.name}<br /><span className="pa-sub">{p.project_number || "—"}</span></td>
                      <td><span className="pa-badge red">{p.reason}</span></td>
                      <td>{p.project_manager_name || "Unassigned"}</td>
                      <td><button className="pa-btn" onClick={e => { e.stopPropagation(); onOpenProject(p.id); }}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pa-card">
          <div className="pa-section-head">
            <div><h2>Service Workload</h2><p>Open requests by service type</p></div>
          </div>
          {Object.keys(stats.serviceWorkload).length === 0 ? (
            <EmptyState message="No open service requests." />
          ) : (
            Object.entries(stats.serviceWorkload).map(([type, count]) => (
              <div key={type} className="pa-row">
                <div className="pa-row-copy"><strong>{SERVICE_REQUEST_TYPE_LABELS[type as ServiceRequestType] ?? type}</strong></div>
                <span className="pa-badge">{count}</span>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="pa-grid three">
        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Project Setup</h2><p>Create internal projects, assign company and initial contacts.</p></div></div>
        </section>
        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Lifecycle Control</h2><p>Progress, correct, complete, archive and restore projects.</p></div></div>
        </section>
        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Audit &amp; History</h2><p>Review project, access and status changes.</p></div></div>
        </section>
      </div>
    </>
  );
};
