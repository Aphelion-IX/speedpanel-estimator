// =============================================================================
// Projects Administration -- per-project scoped sections (Members & Contacts/
// Documents & Activity/Lifecycle & Completion/Audit History)
// =============================================================================
// Each is its own sidebar destination in the design reference (not a tab
// strip within one page) -- AdminProjectsAdministrationPage.tsx renders this
// for all four, switching only the `section` prop. No id-scoped URL param
// exists for Admin sub-routes (see that file's own comment), so this shows a
// project picker up top whenever nothing's selected yet, matching the design
// reference's own "Audit History" page pattern (the one mockup that already
// has an explicit project picker built in) rather than inventing a new UI
// idiom for the other three.
//
// Business logic is never re-implemented here -- every section reuses an
// existing, already-wired component (ProjectMembersCard/ProjectContactsCard/
// ProjectDocumentsCard/AdminProjectOperationsPage/AdminProjectAuditPage).
// Those are shared with the customer-facing project pages too, so they keep
// their own Card/Table shape rather than being rewritten in pa-* classes --
// only their container here is themed. They still pick up this section's
// exact --blue/--navy palette automatically (styleTokens.ts's BLUE/NAVY are
// var(--blue)/var(--navy), scoped by projectsAdminTheme.css's .pa-shell).
// =============================================================================
import { useState } from "react";
import { cx, MUTED } from "../../../styleTokens";
import { LoadingState, ErrorState } from "../../../ui/states";
import { useProject } from "../../projects/projectDetailStore";
import { useProjectActivity, STAGE_EVENT_LABELS, relativeTime } from "../../projects/projectActivityStore";
import { ProjectMembersCard } from "../../projects/ProjectMembersCard";
import { ProjectContactsCard } from "../../projects/ProjectContactsCard";
import { ProjectDocumentsCard } from "../../projects/documents/ProjectDocumentsCard";
import { AdminProjectOperationsPage } from "./AdminProjectOperationsPage";
import { AdminProjectAuditPage } from "./AdminProjectAuditPage";
import { useAdminProjectsOverview } from "./adminProjectsAdminStore";

const SECTION_TITLE: Record<string, { title: string; sub: string }> = {
  people: { title: "Project Members & Contacts", sub: "Manage company access, project-specific permissions and operational contacts." },
  documents: { title: "Project Documents & Activity", sub: "View customer documents, internal files, notes and the full project history." },
  lifecycle: { title: "Lifecycle, Completion & Archive", sub: "Control project status and enforce completion, archive and restore rules." },
  audit: { title: "Project Audit History", sub: "Append-only history of project, access, lifecycle and service changes." },
};

const ActivityFeed = ({ projectId }: { projectId: string }) => {
  const { events, loading, error } = useProjectActivity(projectId);
  if (loading) return <p className={cx.footnote}>Loading activity...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-300">{error}</p>;
  if (events.length === 0) return <p className="pa-sub">No activity yet.</p>;
  return (
    <div>
      {events.map(e => (
        <div key={e.id} className="pa-row">
          <div className="pa-row-copy">
            <strong>{STAGE_EVENT_LABELS[e.event_type]}</strong>
            <span>{relativeTime(e.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProjectPicker = ({ onChoose }: { onChoose: (id: string) => void }) => {
  const { projects, loading } = useAdminProjectsOverview();
  return (
    <div className="pa-card">
      <div className="pa-form">
        <div className="pa-field full">
          <label>Project</label>
          <select disabled={loading} defaultValue="" onChange={e => e.target.value && onChoose(e.target.value)}>
            <option value="" disabled>{loading ? "Loading..." : "Choose a project..."}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} &middot; {p.project_number || p.id.slice(0, 8).toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export const AdminProjectScopedSection = ({ section, projectId, userId, onChangeProject, onBrowseProjects }: {
  section: "people" | "documents" | "lifecycle" | "audit";
  projectId: string | null;
  userId: string | null;
  onChangeProject: (id: string) => void;
  onBrowseProjects: () => void;
}) => {
  const { title, sub } = SECTION_TITLE[section];
  const { project, loading, error, reload } = useProject(projectId ?? "");
  const [pickerOverride, setPickerOverride] = useState(false);

  return (
    <>
      <div className="pa-head">
        <div>
          <h1 className="pa-h1">{title}</h1>
          <p className="pa-sub">{sub}</p>
        </div>
        <div className="pa-actions"><button className="pa-btn" onClick={onBrowseProjects}>Browse Projects</button></div>
      </div>

      {(!projectId || pickerOverride) && <ProjectPicker onChoose={id => { onChangeProject(id); setPickerOverride(false); }} />}

      {projectId && !pickerOverride && (
        loading ? (
          <LoadingState label="Loading project" />
        ) : error || !project ? (
          <ErrorState message={error || "Project not found."} onRetry={() => reload()} />
        ) : (
          <>
            <div className="pa-card">
              <div className="pa-section-head">
                <div>
                  <h2>{project.name}</h2>
                  <p>{project.project_number || project.id.slice(0, 8).toUpperCase()}{project.builder_name ? ` · Builder: ${project.builder_name}` : ""}</p>
                </div>
                <button className="pa-btn" onClick={() => setPickerOverride(true)}>Change Project</button>
              </div>
            </div>

            {section === "lifecycle" && <AdminProjectOperationsPage projectId={project.id} />}

            {section === "people" && (
              <div className="pa-split">
                <div>
                  {project.company_id && <ProjectMembersCard projectId={project.id} companyId={project.company_id} />}
                </div>
                <div className="pa-sticky"><ProjectContactsCard projectId={project.id} /></div>
              </div>
            )}

            {section === "documents" && (
              <div className="pa-split">
                <div><ProjectDocumentsCard projectId={project.id} userId={userId} /></div>
                <div className="pa-sticky pa-card">
                  <div className="pa-section-head"><div><h2>Activity Timeline</h2></div></div>
                  <ActivityFeed projectId={project.id} />
                </div>
              </div>
            )}

            {section === "audit" && <AdminProjectAuditPage projectId={project.id} />}
          </>
        )
      )}

      {!projectId && <p className="mt-3 text-xs" style={{ color: MUTED }}>Choose a project above to see its {title.toLowerCase()}.</p>}
    </>
  );
};
