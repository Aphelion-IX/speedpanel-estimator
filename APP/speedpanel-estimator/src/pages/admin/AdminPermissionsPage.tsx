// =============================================================================
// Admin > Permissions -- onboard or grant access to an EXTERNAL (company)
// user, with or without an invite
// =============================================================================
// External-only by design -- internal staff access lives on Admin > Users
// ("Add Speedpanel staff" / "Promote an existing account to staff") instead,
// not here, so this page has one clear scope. Company access below
// consolidates a capability that already existed as a secondary form buried
// elsewhere (CompanyMemberList.tsx's "Add an existing account") into a
// prominent, dedicated card -- that original form stays too, this page is
// an additional, more discoverable entry point, not a replacement.
//
// Company access is for an account that ALREADY exists (a former customer
// signup, or one created directly in Supabase) -- no email is sent. Add
// company user is the brand-new-account counterpart, mirroring
// AdminUsersPage.tsx's "Add Speedpanel staff" card -- a Method dropdown
// picks between creating the account with a password set directly (no
// email) or sending an invite email. Both RPCs/Edge Functions here
// (admin_add_company_member_by_email, admin-invite-user) are
// has_staff_role()-gated (super_admin) server-side, see supabase/schema.sql.
// =============================================================================
import { useEffect, useState } from "react";
import { cx, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field, SelectField } from "../shared/fields";
import { COMPANY_ROLES, COMPANY_ROLE_LABELS, type CompanyRole } from "../company/companyTypes";
import { useAdminCompanies, adminGrantCompanyAccess, adminCreateCompanyUser } from "./companies/companiesStore";

const COMPANY_ROLE_OPTIONS = COMPANY_ROLES.map(value => ({ value, label: COMPANY_ROLE_LABELS[value] }));

const CREATE_METHOD_OPTIONS = [
  { value: "password", label: "Set password directly" },
  { value: "invite", label: "Send invite email" },
];
type CreateMethod = "password" | "invite";

// Brand-new-account counterpart to CompanyAccessCard below -- same Method
// dropdown pattern as AdminUsersPage.tsx's CreateStaffForm, applied to an
// external user instead of staff (companyId/companyRole on
// admin-invite-user rather than staffRole -- see companiesStore.ts's
// adminCreateCompanyUser).
const AddCompanyUserForm = ({ companies, onCreate }: {
  companies: { id: string; name: string }[];
  onCreate: (companyId: string, email: string, role: CompanyRole, password: string | null) => Promise<string | null>;
}) => {
  const [companyId, setCompanyId] = useState("");
  const [method, setMethod] = useState<CreateMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CompanyRole>("owner");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-select the first company once the (async) list loads, so the form
  // is usable in one step for the common case -- but never override a
  // choice the admin already made.
  useEffect(() => { if (!companyId && companies.length > 0) setCompanyId(companies[0].id); }, [companies, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !companyId || (method === "password" && password.length < 8)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const err = await onCreate(companyId, email.trim(), role, method === "password" ? password : null);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setPassword("");
    setSuccess(method === "password" ? "Created -- their account is live now with the password you set." : "Invited -- they'll get an email to set their password.");
  };

  const companyOptions = companyId
    ? companies.map(c => ({ value: c.id, label: c.name }))
    : [{ value: "", label: "Choose a company..." }, ...companies.map(c => ({ value: c.id, label: c.name }))];

  return (
    <div className={cx.card}>
      <div className={cx.cardHd}>Add company user</div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Onboard a brand-new external user straight into a company workspace.</p>
      {companies.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: MUTED }}>No companies yet -- create one on Admin &gt; Companies first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <SelectField label="Company" value={companyId} options={companyOptions} onChange={setCompanyId} />
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
            <button type="submit" disabled={submitting || !email.trim() || !companyId || (method === "password" && password.length < 8)}
              className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              {submitting ? "Adding..." : method === "password" ? "Create" : "Invite"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>{success}</p>}
    </div>
  );
};

const CompanyAccessCard = ({ companies, onGrant }: {
  companies: { id: string; name: string }[];
  onGrant: (companyId: string, email: string, role: CompanyRole) => Promise<string | null>;
}) => {
  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("owner");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-select the first company once the (async) list loads, so the form
  // is usable in one step for the common case -- but never override a
  // choice the admin already made.
  useEffect(() => { if (!companyId && companies.length > 0) setCompanyId(companies[0].id); }, [companies, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !companyId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const err = await onGrant(companyId, email.trim(), role);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setSuccess(true);
  };

  const companyOptions = companyId
    ? companies.map(c => ({ value: c.id, label: c.name }))
    : [{ value: "", label: "Choose a company..." }, ...companies.map(c => ({ value: c.id, label: c.name }))];

  return (
    <div className={`${cx.card} mt-4`}>
      <div className={cx.cardHd}>Company access</div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Grant an existing account access to a company workspace. No email is sent -- their existing login already works.</p>
      {companies.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: MUTED }}>No companies yet -- create one on Admin &gt; Companies first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <SelectField label="Company" value={companyId} options={companyOptions} onChange={setCompanyId} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
            <div className="sm:w-56"><SelectField label="Role" value={role} options={COMPANY_ROLE_OPTIONS} onChange={v => setRole(v as CompanyRole)} /></div>
            <button type="submit" disabled={submitting || !email.trim() || !companyId}
              className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              {submitting ? "Granting..." : "Grant"}
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Granted -- they now have access to that company.</p>}
    </div>
  );
};

export const AdminPermissionsPage = () => {
  const { companies } = useAdminCompanies();

  return (
    <div className="mt-2">
      <AddCompanyUserForm companies={companies} onCreate={(companyId, email, role, password) =>
        adminCreateCompanyUser({ companyId, email, role, password: password ?? undefined })} />
      <CompanyAccessCard companies={companies} onGrant={(companyId, email, role) => adminGrantCompanyAccess({ companyId, email, role })} />
    </div>
  );
};
