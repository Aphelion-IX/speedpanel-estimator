// =============================================================================
// Projects Administration -- single project admin detail
// =============================================================================
// Consolidates Lifecycle & Completion / Members & Contacts / Documents &
// Activity / Audit History into one tabbed page rather than four separate
// top-level routes -- useHashRoute.ts has no id-scoped param support for
// Admin sub-routes (see AdminProjectsAdministrationPage.tsx's own comment),
// so the selected project id lives in that page's local state and this
// panel just receives it as a prop, same convention AdminProjectsPage.tsx's
// row-accordion already uses for AdminProjectOperationsPage/
// AdminProjectAuditPage. Every tab reuses an existing, already-wired
// component rather than re-implementing it.
// =============================================================================
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cx, NAVY, MUTED, BLUE } from "../../../styleTokens";
import { LoadingState, ErrorState } from "../../../ui/states";
import { Tabs, TabPanel } from "../../../ui/tabs";
import { useProject } from "../../projects/projectDetailStore";
import { useProjectActivity, STAGE_EVENT_LABELS, relativeTime } from "../../projects/projectActivityStore";
import { ProjectMembersCard } from "../../projects/ProjectMembersCard";
import { ProjectContactsCard } from "../../projects/ProjectContactsCard";
import { ProjectDocumentsCard } from "../../projects/documents/ProjectDocumentsCard";
import { AdminProjectOperationsPage } from "./AdminProjectOperationsPage";
import { AdminProjectAuditPage } from "./AdminProjectAuditPage";

const TABS = [
  { id: "lifecycle", label: "Lifecycle & Completion" },
  { id: "people", label: "Members & Contacts" },
  { id: "documents", label: "Documents & Activity" },
  { id: "audit", label: "Audit History" },
];

const ActivityFeed = ({ projectId }: { projectId: string }) => {
  const { events, loading, error } = useProjectActivity(projectId);
  if (loading) return <p className={cx.footnote}>Loading activity...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-300">{error}</p>;
  if (events.length === 0) return <p className={cx.footnote} style={{ paddingTop: 0 }}>No activity yet.</p>;
  return (
    <div className="space-y-2">
      {events.map(e => (
        <div key={e.id} className={cx.rowBorder}>
          <p className="text-sm font-semibold" style={{ color: NAVY }}>{STAGE_EVENT_LABELS[e.event_type]}</p>
          <p className={cx.footnote} style={{ paddingTop: 0 }}>{relativeTime(e.created_at)}</p>
        </div>
      ))}
    </div>
  );
};

export const AdminProjectDetailPanel = ({ projectId, userId, onBack }: { projectId: string; userId: string | null; onBack: () => void }) => {
  const { project, loading, error, reload } = useProject(projectId);
  const [activeTab, setActiveTab] = useState("lifecycle");

  return (
    <div className="mt-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
        <ChevronLeft size={15} />All Projects
      </button>

      {loading ? (
        <LoadingState className="mt-3" label="Loading project" />
      ) : error || !project ? (
        <ErrorState className="mt-3" message={error || "Project not found."} onRetry={() => reload()} />
      ) : (
        <>
          <div className={`${cx.card} mt-3`}>
            <h1 className={cx.h1}>{project.name}</h1>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>
              {project.project_number || project.id.slice(0, 8).toUpperCase()}
              {project.builder_name ? ` · Builder: ${project.builder_name}` : ""}
            </p>
          </div>

          <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

          <TabPanel id="lifecycle" activeId={activeTab}>
            <AdminProjectOperationsPage projectId={projectId} />
          </TabPanel>

          <TabPanel id="people" activeId={activeTab}>
            <div className="grid gap-4 xl:grid-cols-2">
              {project.company_id && <ProjectMembersCard projectId={project.id} companyId={project.company_id} />}
              <ProjectContactsCard projectId={project.id} />
            </div>
          </TabPanel>

          <TabPanel id="documents" activeId={activeTab}>
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <ProjectDocumentsCard projectId={project.id} userId={userId} />
              <div className={cx.card}>
                <div className={cx.cardHd}>Activity Timeline</div>
                <div className="mt-2"><ActivityFeed projectId={project.id} /></div>
              </div>
            </div>
          </TabPanel>

          <TabPanel id="audit" activeId={activeTab}>
            <AdminProjectAuditPage projectId={projectId} />
          </TabPanel>
        </>
      )}
    </div>
  );
};
