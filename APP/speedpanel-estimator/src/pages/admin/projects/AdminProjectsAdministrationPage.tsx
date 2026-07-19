// =============================================================================
// Admin > Projects Administration -- dashboard, full project browser,
// admin-side project creation, and per-project detail
// =============================================================================
// Persistent left sidebar nav matching UI-DESIGNS/internal/*.html's fuller
// 8-item nav (Overview/Projects/Create Project/Members & Contacts/Service
// Requests/Documents & Activity/Lifecycle & Completion/Audit History)
// exactly -- see projectsAdminTheme.css for the scoped palette/shape this
// page and its panels render with. "Service Requests" jumps out to the
// existing, already-wired Admin > Support Requests page (a global queue,
// not project-scoped) via `navigate`, same route the Admin Dashboard tile
// already reaches.
//
// The four project-scoped items (Members & Contacts/Documents & Activity/
// Lifecycle & Completion/Audit History) are per-project full pages in the
// design reference, reached by first opening a project -- there's no
// id-scoped URL param for Admin sub-routes (see AdminProjectDetailPanel.tsx
// for the fuller explanation), so the selected project lives in local state
// here and each scoped section shows its own project picker up top when
// nothing's selected yet, mirroring the design reference's own "Audit
// History" page (the one mockup that already has an explicit project
// picker built in).
// =============================================================================
import { useState } from "react";
import { LayoutDashboard, Search, FolderPlus, Users, MessageSquare, FileText, RefreshCcw, History } from "lucide-react";
import type { Route } from "../../../appShell/useHashRoute";
import "./projectsAdminTheme.css";
import { AdminProjectsOverviewPanel } from "./AdminProjectsOverviewPanel";
import { AdminProjectsBrowserPanel } from "./AdminProjectsBrowserPanel";
import { AdminProjectCreatePanel } from "./AdminProjectCreatePanel";
import { AdminProjectScopedSection } from "./AdminProjectDetailPanel";

type View = "overview" | "browse" | "create" | "people" | "serviceRequests" | "documents" | "lifecycle" | "audit";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={14} /> },
  { id: "browse", label: "Projects", icon: <Search size={14} /> },
  { id: "create", label: "Create Project", icon: <FolderPlus size={14} /> },
  { id: "people", label: "Members & Contacts", icon: <Users size={14} /> },
  { id: "serviceRequests", label: "Service Requests", icon: <MessageSquare size={14} /> },
  { id: "documents", label: "Documents & Activity", icon: <FileText size={14} /> },
  { id: "lifecycle", label: "Lifecycle & Completion", icon: <RefreshCcw size={14} /> },
  { id: "audit", label: "Audit History", icon: <History size={14} /> },
];

export const AdminProjectsAdministrationPage = ({ userId, navigate }: { userId: string | null; navigate: (r: Route) => void }) => {
  const [view, setView] = useState<View>("overview");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const goTo = (v: View) => {
    if (v === "serviceRequests") { navigate({ tab: "admin", sub: "serviceRequests" }); return; }
    setView(v);
  };

  const openProject = (id: string, section: View = "lifecycle") => {
    setSelectedProjectId(id);
    setView(section);
  };

  return (
    <div className="pa-shell mt-2">
      <div className="pa-layout">
        <aside className="pa-side">
          <nav className="pa-nav">
            {NAV.map(n => (
              <button key={n.id} className={n.id === view ? "active" : ""} onClick={() => goTo(n.id)}>
                <span className="inline-flex items-center gap-2">{n.icon}{n.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="pa-page">
          <div className="pa-crumb">Projects Administration &rsaquo; {NAV.find(n => n.id === view)?.label}</div>

          {view === "overview" && (
            <>
              <div className="pa-head">
                <div>
                  <h1 className="pa-h1">Projects Backend Overview</h1>
                  <p className="pa-sub">Operational view of project setup, assignments, lifecycle exceptions and open services.</p>
                </div>
                <div className="pa-actions">
                  <button className="pa-btn" onClick={() => goTo("browse")}>Open Project Queue</button>
                  <button className="pa-btn primary" onClick={() => goTo("create")}>Create Project</button>
                </div>
              </div>
              <AdminProjectsOverviewPanel onOpenProject={id => openProject(id)} />
            </>
          )}

          {view === "browse" && (
            <>
              <div className="pa-head">
                <div>
                  <h1 className="pa-h1">Projects Administration</h1>
                  <p className="pa-sub">Manage customer projects, internal ownership, lifecycle status and exceptions.</p>
                </div>
                <div className="pa-actions"><button className="pa-btn primary" onClick={() => goTo("create")}>Create Internal Project</button></div>
              </div>
              <AdminProjectsBrowserPanel onOpenProject={id => openProject(id)} />
            </>
          )}

          {view === "create" && (
            <>
              <div className="pa-head">
                <div>
                  <h1 className="pa-h1">Create Internal Project</h1>
                  <p className="pa-sub">Create a project on behalf of a company and complete all required internal setup.</p>
                </div>
                <div className="pa-actions"><button className="pa-btn" onClick={() => goTo("browse")}>Cancel</button></div>
              </div>
              <AdminProjectCreatePanel onCreated={id => openProject(id)} />
            </>
          )}

          {(view === "people" || view === "documents" || view === "lifecycle" || view === "audit") && (
            <AdminProjectScopedSection
              section={view}
              projectId={selectedProjectId}
              userId={userId}
              onChangeProject={setSelectedProjectId}
              onBrowseProjects={() => goTo("browse")}
            />
          )}
        </div>
      </div>
    </div>
  );
};
