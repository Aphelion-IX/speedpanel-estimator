// =============================================================================
// Projects Administration -- admin-side project creation
// =============================================================================
// Picks an existing company + one of its active members as the project's
// owner_id (projects.owner_id is not-null -- someone has to own it, and the
// natural owner for a staff-created project is the customer's own project
// contact, not the creating admin). Optionally assigns an internal PM from
// the staff directory. See adminProjectsAdminStore.ts's admin_create_project
// call for why `data` is built with blankSnapshot(), not fabricated here.
// The "Creation Checklist" reflects the actual form state live, not the
// design reference's static example -- Ready only once a field the form
// actually requires is filled.
// =============================================================================
import { useState } from "react";
import { useAdminCompanies } from "../companies/companiesStore";
import { useCompanyMembers } from "../../company/companyStore";
import { useAdminUsers } from "../users/usersStore";
import { useAdminCreateProject } from "./adminProjectsAdminStore";

export const AdminProjectCreatePanel = ({ onCreated }: { onCreated: (id: string) => void }) => {
  const { companies, loading: companiesLoading } = useAdminCompanies();
  const { users: staff, loading: staffLoading } = useAdminUsers();
  const { submitting, createProject } = useAdminCreateProject();

  const [companyId, setCompanyId] = useState("");
  const { members, loading: membersLoading } = useCompanyMembers(companyId || null);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [name, setName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectManagerUserId, setProjectManagerUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeMembers = members.filter(m => m.status === "active");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyId) { setError("Choose a company."); return; }
    if (!ownerUserId) { setError("Choose a customer project contact."); return; }
    if (!name.trim()) { setError("Project name is required."); return; }
    const { id, error: createError } = await createProject({
      companyId, ownerUserId, name: name.trim(),
      siteAddress: siteAddress.trim() || undefined,
      builderName: builderName.trim() || undefined,
      startDate: startDate || undefined,
      projectManagerUserId: projectManagerUserId || undefined,
    });
    if (createError || !id) { setError(createError); return; }
    onCreated(id);
  };

  return (
    <form onSubmit={submit} className="pa-split">
      <div>
        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Company &amp; Project</h2><p>Core customer-facing details</p></div></div>
          <div className="pa-form">
            <div className="pa-field full">
              <label>Company</label>
              <select value={companyId} onChange={e => { setCompanyId(e.target.value); setOwnerUserId(""); }}>
                <option value="">{companiesLoading ? "Loading..." : "Choose a company..."}</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="pa-field full"><label>Project Name</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" /></div>
            <div className="pa-field full"><label>Project Address</label><input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Project address" /></div>
            <div className="pa-field"><label>Builder</label><input value={builderName} onChange={e => setBuilderName(e.target.value)} placeholder="Builder name" /></div>
            <div className="pa-field"><label>Start Date</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          </div>
        </section>

        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Customer Access</h2><p>Assign the first project member and project contact</p></div></div>
          <div className="pa-form">
            <div className="pa-field full">
              <label>Customer Project Contact</label>
              <select value={ownerUserId} onChange={e => setOwnerUserId(e.target.value)}>
                <option value="">{!companyId ? "Choose a company first..." : membersLoading ? "Loading..." : activeMembers.length === 0 ? "No active members" : "Choose..."}</option>
                {activeMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.email || m.user_id}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Internal Assignments</h2></div></div>
          <div className="pa-form">
            <div className="pa-field full">
              <label>Project Manager</label>
              <select value={projectManagerUserId} onChange={e => setProjectManagerUserId(e.target.value)}>
                <option value="">{staffLoading ? "Loading..." : "Unassigned"}</option>
                {staff.map(u => <option key={u.id} value={u.id}>{u.display_name || u.email || u.id}</option>)}
              </select>
            </div>
          </div>
        </section>

        {error && <p className="mt-2 mb-3 text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        <button type="submit" className="pa-btn primary" disabled={submitting}>{submitting ? "Creating..." : "Create Project"}</button>
      </div>

      <aside className="pa-sticky">
        <section className="pa-card">
          <div className="pa-section-head"><div><h2>Creation Checklist</h2></div></div>
          <div className="pa-row">
            <div className="pa-row-copy"><strong>Company</strong><span>Required</span></div>
            <span className={`pa-badge ${companyId ? "green" : "neutral"}`}>{companyId ? "Ready" : "Pending"}</span>
          </div>
          <div className="pa-row">
            <div className="pa-row-copy"><strong>Project details</strong><span>Name required</span></div>
            <span className={`pa-badge ${name.trim() ? "green" : "neutral"}`}>{name.trim() ? "Ready" : "Pending"}</span>
          </div>
          <div className="pa-row">
            <div className="pa-row-copy"><strong>Customer contact</strong><span>Required</span></div>
            <span className={`pa-badge ${ownerUserId ? "green" : "neutral"}`}>{ownerUserId ? "Ready" : "Pending"}</span>
          </div>
          <div className="pa-row">
            <div className="pa-row-copy"><strong>Internal PM</strong><span>Recommended before activation</span></div>
            <span className={`pa-badge ${projectManagerUserId ? "green" : "neutral"}`}>{projectManagerUserId ? "Ready" : "Pending"}</span>
          </div>
        </section>
        <section className="pa-card">
          <div className="pa-notice"><div><strong>Project number</strong><span>Generated automatically after creation.</span></div></div>
        </section>
      </aside>
    </form>
  );
};
