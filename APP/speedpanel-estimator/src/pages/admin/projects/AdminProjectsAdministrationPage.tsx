// =============================================================================
// Admin > Projects Administration -- dashboard, full project browser,
// admin-side project creation, and per-project detail
// =============================================================================
// One route.sub ("projectsAdmin") whose internal view (overview/browse/
// create, or a selected project's detail) lives in local component state,
// not the URL -- useHashRoute.ts has no id-scoped param support for Admin
// sub-routes today (see AdminProjectDetailPanel.tsx's own comment), so this
// isn't deep-linkable to a specific project yet, same limitation
// AdminProjectsPage.tsx's row-accordion already has.
// =============================================================================
import { useState } from "react";
import { LayoutDashboard, Search, FolderPlus } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { AdminProjectsOverviewPanel } from "./AdminProjectsOverviewPanel";
import { AdminProjectsBrowserPanel } from "./AdminProjectsBrowserPanel";
import { AdminProjectCreatePanel } from "./AdminProjectCreatePanel";
import { AdminProjectDetailPanel } from "./AdminProjectDetailPanel";

type View = "overview" | "browse" | "create";

const VIEW_TABS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
  { id: "browse", label: "All Projects", icon: <Search size={14} /> },
  { id: "create", label: "Create Project", icon: <FolderPlus size={14} /> },
];

export const AdminProjectsAdministrationPage = ({ userId }: { userId: string | null }) => {
  const [view, setView] = useState<View>("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  if (selectedProjectId) {
    return <AdminProjectDetailPanel projectId={selectedProjectId} userId={userId} onBack={() => setSelectedProjectId(null)} />;
  }

  return (
    <div className="mt-2">
      <h1 className={cx.h1}>Projects Administration</h1>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>Operational view of project setup, assignments, lifecycle exceptions and open services.</p>

      <div className={`${cx.tabList} mt-4`}>
        {VIEW_TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} className={t.id === view ? cx.tabActive : cx.tabInactive}>
            <span className="inline-flex items-center gap-1.5"><span style={{ color: t.id === view ? undefined : NAVY }}>{t.icon}</span>{t.label}</span>
          </button>
        ))}
      </div>

      {view === "overview" && <AdminProjectsOverviewPanel onOpenProject={setSelectedProjectId} />}
      {view === "browse" && <AdminProjectsBrowserPanel onOpenProject={setSelectedProjectId} />}
      {view === "create" && <AdminProjectCreatePanel onCreated={id => { setSelectedProjectId(id); }} />}
    </div>
  );
};
