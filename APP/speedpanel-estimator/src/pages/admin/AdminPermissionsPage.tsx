// =============================================================================
// Admin > Permissions -- grant staff or company access without an invite
// =============================================================================
// Consolidates two capabilities that already existed as secondary forms
// buried elsewhere (AdminUsersPage.tsx's "Promote an existing account to
// staff", CompanyMemberList.tsx's "Add an existing account") into one
// prominent, dedicated card. Both stay where they were too -- this page is
// an additional, more discoverable entry point, not a replacement.
//
// Both actions are for an account that ALREADY exists (a former customer
// signup, or one created directly in Supabase) -- no email is sent, unlike
// the "Invite" flows on Admin > Users / Admin > Companies, which create a
// brand-new account and do send one. Both RPCs (admin_promote_user_to_staff_by_email,
// admin_add_company_member_by_email) are has_staff_role()-gated
// (super_admin) server-side, see supabase/schema.sql.
// =============================================================================
import { useEffect, useState } from "react";
import { cx, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field, SelectField } from "../shared/fields";
import { INTERNAL_ROLES, INTERNAL_ROLE_LABELS, type InternalRole } from "../company/staffTypes";
import { COMPANY_ROLES, COMPANY_ROLE_LABELS, type CompanyRole } from "../company/companyTypes";
import { useAdminUsers } from "./users/usersStore";
import { useAdminCompanies, adminGrantCompanyAccess } from "./companies/companiesStore";

const STAFF_ROLE_OPTIONS = INTERNAL_ROLES.map(value => ({ value, label: INTERNAL_ROLE_LABELS[value] }));
const COMPANY_ROLE_OPTIONS = COMPANY_ROLES.map(value => ({ value, label: COMPANY_ROLE_LABELS[value] }));

const StaffAccessCard = ({ onGrant }: { onGrant: (email: string, staffRole: InternalRole) => Promise<string | null> }) => {
  const [email, setEmail] = useState("");
  const [staffRole, setStaffRole] = useState<InternalRole>("project_manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    const err = await onGrant(email.trim(), staffRole);
    setSubmitting(false);
    if (err) { setError(err); return; }
    setEmail("");
    setSuccess(true);
  };

  return (
    <div className={cx.card}>
      <div className={cx.cardHd}>Staff access</div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Grant an existing account an internal staff role. No email is sent -- their existing login already works.</p>
      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" /></div>
        <div className="sm:w-56"><SelectField label="Staff role" value={staffRole} options={STAFF_ROLE_OPTIONS} onChange={v => setStaffRole(v as InternalRole)} /></div>
        <button type="submit" disabled={submitting || !email.trim()}
          className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {submitting ? "Granting..." : "Grant"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="mt-2 text-sm font-semibold" style={{ color: BLUE }}>Granted -- they now have staff access.</p>}
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
  const { promoteToStaff } = useAdminUsers();
  const { companies } = useAdminCompanies();

  return (
    <div className="mt-2">
      <StaffAccessCard onGrant={promoteToStaff} />
      <CompanyAccessCard companies={companies} onGrant={(companyId, email, role) => adminGrantCompanyAccess({ companyId, email, role })} />
    </div>
  );
};
