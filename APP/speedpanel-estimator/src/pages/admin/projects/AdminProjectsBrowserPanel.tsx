// =============================================================================
// Projects Administration -- full project browser
// =============================================================================
// Unlike adminProjectsStore.ts's review queue (stage in install_review/
// technical_review only), this lists EVERY project via
// admin_list_projects_overview() -- search + row click into
// AdminProjectScopedSection.tsx. Styled with projectsAdminTheme.css's pa-*
// classes to match UI-DESIGNS/internal/projects-admin.html exactly.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { PROJECT_OPERATIONAL_STATUS_LABELS } from "../../projects/projectOperationsTypes";
import { useAdminProjectsOverview } from "./adminProjectsAdminStore";

export const AdminProjectsBrowserPanel = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
  const { projects, loading, error, reload } = useAdminProjectsOverview();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      [p.name, p.project_number ?? "", p.company_name ?? "", p.project_manager_name ?? ""].join(" ").toLowerCase().includes(q));
  }, [projects, query]);

  if (loading) return <LoadingState className="mt-4" label="Loading projects" />;
  if (error) return <ErrorState className="mt-4" message={error} onRetry={() => reload()} />;

  return (
    <>
      <div className="pa-search">
        <Search size={15} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Project, company, builder, project number or internal owner" />
      </div>

      {filtered.length === 0 ? (
        <div className="pa-card"><EmptyState message="No projects match your search." /></div>
      ) : (
        <div className="pa-card">
          <div className="pa-table-wrap">
            <table className="pa-table">
              <thead>
                <tr><th>Project</th><th>Company</th><th>Status</th><th>Internal PM</th><th>Open Orders</th><th>Services</th><th></th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => onOpenProject(p.id)}>
                    <td>{p.name}<br /><span className="pa-sub">{p.project_number || p.id.slice(0, 8).toUpperCase()}</span></td>
                    <td>{p.company_name || "—"}</td>
                    <td><span className="pa-badge">{PROJECT_OPERATIONAL_STATUS_LABELS[p.operational_status as keyof typeof PROJECT_OPERATIONAL_STATUS_LABELS] ?? p.operational_status}</span></td>
                    <td>{p.project_manager_name || "Unassigned"}</td>
                    <td>{p.open_orders}</td>
                    <td>{p.open_services}</td>
                    <td>{p.archived_at && <span className="pa-badge neutral">Archived</span>}</td>
                    <td><button className="pa-btn" onClick={e => { e.stopPropagation(); onOpenProject(p.id); }}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
