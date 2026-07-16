// =============================================================================
// Admin > Companies -- "Create user" accordion, one per company row
// =============================================================================
// Brand-new external account creation, scoped to the company this form is
// rendered inside (companyId is a prop, not a picker) -- was a page-level
// form on Admin > Permissions with its own company picker; moved here per
// the People-section reorg so external-user creation lives entirely under
// Companies. Same Method dropdown (password vs. invite email) pattern as
// AdminUsersPage.tsx's CreateStaffForm and adminCreateCompanyUser() itself
// (companiesStore.ts) -- unchanged, only the company selection is gone.
// The Edge Function's own gate is has_permission('companies.create_company_user')
// server-side (see supabase/functions/admin-invite-user/index.ts).
// =============================================================================
import { useState } from "react";
import { BLUE, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { Field, SelectField } from "../../shared/fields";
import { COMPANY_ROLES, COMPANY_ROLE_LABELS, type CompanyRole } from "../../company/companyTypes";
import { adminCreateCompanyUser } from "./companiesStore";

const COMPANY_ROLE_OPTIONS = COMPANY_ROLES.map(value => ({ value, label: COMPANY_ROLE_LABELS[value] }));

const CREATE_METHOD_OPTIONS = [
  { value: "password", label: "Set password directly" },
  { value: "invite", label: "Send invite email" },
];
type CreateMethod = "password" | "invite";

export const CreateCompanyUserForm = ({ companyId }: { companyId: string }) => {
  const [method, setMethod] = useState<CreateMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CompanyRole>("owner");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (method === "password" && password.length < 8)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const err = await adminCreateCompanyUser({
      companyId, email: email.trim(), role, password: method === "password" ? password : undefined,
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setPassword("");
    setSuccess(method === "password" ? "Created -- their account is live now with the password you set." : "Invited -- they'll get an email to set their password.");
  };

  return (
    <div>
      <p className="text-xs" style={{ color: MUTED }}>Onboard a brand-new external user straight into this company's workspace.</p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:w-56"><SelectField label="Method" value={method} options={CREATE_METHOD_OPTIONS} onChange={v => setMethod(v as CreateMethod)} /></div>
          <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
          <div className="sm:w-56"><SelectField label="Role" value={role} options={COMPANY_ROLE_OPTIONS} onChange={v => setRole(v as CompanyRole)} /></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          {method === "password" && (
            <div className="flex-1">
              <Field label="Password" value={password} onChange={setPassword} type="password" required autoComplete="new-password" />
              <p className="mt-1 text-xs" style={{ color: MUTED }}>At least 8 characters. Share it with them directly -- it's never shown again.</p>
            </div>
          )}
          <Button type="submit" className="h-[46px] shrink-0" disabled={submitting || !email.trim() || (method === "password" && password.length < 8)}>
            {submitting ? "Adding..." : method === "password" ? "Create" : "Invite"}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{success}</p>}
    </div>
  );
};
