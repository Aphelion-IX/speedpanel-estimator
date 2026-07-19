// =============================================================================
// Projects Administration -- full project browser
// =============================================================================
// Unlike adminProjectsStore.ts's review queue (stage in install_review/
// technical_review only), this lists EVERY project via
// admin_list_projects_overview() -- search + row click into
// AdminProjectDetailPanel.tsx.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED, tone } from "../../../styleTokens";
import { Table, type TableColumn } from "../../../ui/table";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { PROJECT_OPERATIONAL_STATUS_BADGE_CLASS, PROJECT_OPERATIONAL_STATUS_LABELS } from "../../projects/projectOperationsTypes";
import { useAdminProjectsOverview, type AdminProjectOverviewRow } from "./adminProjectsAdminStore";

export const AdminProjectsBrowserPanel = ({ onOpenProject }: { onOpenProject: (id: string) => void }) => {
  const { projects, loading, error, reload } = useAdminProjectsOverview();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p =>
      [p.name, p.project_number ?? "", p.company_name ?? "", p.project_manager_name ?? ""].join(" ").toLowerCase().includes(q));
  }, [projects, query]);

  const columns: TableColumn<AdminProjectOverviewRow>[] = [
    {
      key: "project", header: "Project",
      cell: p => (
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>{p.name}</div>
          <div className={cx.footnote} style={{ paddingTop: 0 }}>{p.project_number || p.id.slice(0, 8).toUpperCase()}</div>
        </div>
      ),
    },
    { key: "company", header: "Company", cell: p => <span className="text-sm" style={{ color: NAVY }}>{p.company_name || "—"}</span> },
    {
      key: "status", header: "Status",
      cell: p => (
        <span className={`${cx.badge} ${PROJECT_OPERATIONAL_STATUS_BADGE_CLASS[p.operational_status as keyof typeof PROJECT_OPERATIONAL_STATUS_LABELS] ?? tone("neutral")}`}>
          {PROJECT_OPERATIONAL_STATUS_LABELS[p.operational_status as keyof typeof PROJECT_OPERATIONAL_STATUS_LABELS] ?? p.operational_status}
        </span>
      ),
    },
    { key: "pm", header: "Internal PM", cell: p => <span className="text-sm" style={{ color: p.project_manager_name ? NAVY : MUTED }}>{p.project_manager_name || "Unassigned"}</span> },
    { key: "orders", header: "Open Orders", align: "right", cell: p => <span className="text-sm" style={{ color: NAVY }}>{p.open_orders}</span> },
    { key: "services", header: "Services", align: "right", cell: p => <span className="text-sm" style={{ color: NAVY }}>{p.open_services}</span> },
    {
      key: "archived", header: "", align: "right",
      cell: p => p.archived_at ? <span className={`${cx.badge} ${tone("neutral")}`}>Archived</span> : null,
    },
  ];

  if (loading) return <LoadingState className="mt-4" label="Loading projects" />;
  if (error) return <ErrorState className="mt-4" message={error} onRetry={() => reload()} />;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
        <Search size={16} className="shrink-0" style={{ color: MUTED }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Project, company, project number or internal PM"
          className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No projects match your search." />
      ) : (
        <Table className="mt-3" columns={columns} rows={filtered} rowKey={p => p.id} onRowClick={p => onOpenProject(p.id)} />
      )}
    </div>
  );
};
