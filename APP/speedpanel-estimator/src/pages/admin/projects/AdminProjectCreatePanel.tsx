// =============================================================================
// Projects Administration -- admin-side project creation
// =============================================================================
// Picks an existing company + one of its active members as the project's
// owner_id (projects.owner_id is not-null -- someone has to own it, and the
// natural owner for a staff-created project is the customer's own project
// contact, not the creating admin). Optionally assigns an internal PM from
// the staff directory. See adminProjectsAdminStore.ts's admin_create_project
// call for why `data` is built with blankSnapshot(), not fabricated here.
// =============================================================================
import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { MUTED } from "../../../styleTokens";
import { Card } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { Field, SelectField } from "../../shared/fields";
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
    <div className="mt-4">
      <form onSubmit={submit}>
        <Card title="Create Internal Project" icon={<FolderPlus size={14} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SelectField label="Company" value={companyId}
                options={[{ value: "", label: companiesLoading ? "Loading..." : "Choose a company..." }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                onChange={v => { setCompanyId(v); setOwnerUserId(""); }} />
            </div>
            <div className="sm:col-span-2">
              <Field label="Project Name" value={name} onChange={setName} required />
            </div>
            <div className="sm:col-span-2">
              <Field label="Project Address" value={siteAddress} onChange={setSiteAddress} />
            </div>
            <Field label="Builder" value={builderName} onChange={setBuilderName} />
            <Field label="Start Date" type="date" value={startDate} onChange={setStartDate} />
            <SelectField label="Customer Project Contact" value={ownerUserId}
              options={[
                { value: "", label: !companyId ? "Choose a company first..." : membersLoading ? "Loading..." : activeMembers.length === 0 ? "No active members" : "Choose..." },
                ...activeMembers.map(m => ({ value: m.user_id, label: m.email || m.user_id })),
              ]}
              onChange={setOwnerUserId} />
            <SelectField label="Internal Project Manager" value={projectManagerUserId}
              options={[
                { value: "", label: staffLoading ? "Loading..." : "Unassigned" },
                ...staff.map(u => ({ value: u.id, label: u.display_name || u.email || u.id })),
              ]}
              onChange={setProjectManagerUserId} />
          </div>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

          <div className="mt-4">
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Project"}</Button>
          </div>
          <p className="mt-2 text-xs" style={{ color: MUTED }}>Project number is generated automatically after creation.</p>
        </Card>
      </form>
    </div>
  );
};
