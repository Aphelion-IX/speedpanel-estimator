// =============================================================================
// Admin > Companies -- read-only support visibility
// =============================================================================
// List of every company workspace + member count, each expandable to its
// roster (role/status/joined date) via the same AccordionCard pattern
// AdminRequestsPage.tsx/AdminProjectsPage.tsx already use for "attached
// data, not the page's main focus". No write actions here -- see
// companiesStore.ts's own header comment for why this stays read-only.
// =============================================================================
import { cx, NAVY, MUTED } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { COMPANY_ROLE_LABELS, MEMBERSHIP_STATUS_BADGE_CLASS } from "../company/companyTypes";
import { useAdminCompanies, useAdminCompanyMembers, type AdminCompanyRow } from "./companies/companiesStore";

const CompanyMembersList = ({ companyId }: { companyId: string }) => {
  const { members, loading, error } = useAdminCompanyMembers(companyId);
  if (loading) return <p className={cx.footnote}>Loading...</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (members.length === 0) return <p className={cx.footnote}>No members.</p>;
  return (
    <div className="space-y-2">
      {members.map(m => (
        <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div>
            <div className="text-sm font-semibold" style={{ color: NAVY }}>{m.email ?? "(no email)"}</div>
            <p className={cx.footnote}>{COMPANY_ROLE_LABELS[m.role]} &middot; Joined {new Date(m.joined_at).toLocaleDateString()}</p>
          </div>
          <span className={`${cx.badge} ${MEMBERSHIP_STATUS_BADGE_CLASS[m.status]}`}>{m.status}</span>
        </div>
      ))}
    </div>
  );
};

const CompanyRow = ({ company }: { company: AdminCompanyRow }) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-bold" style={{ color: NAVY }}>{company.name}</div>
      <div className={cx.footnote}>{company.member_count} member{company.member_count === 1 ? "" : "s"}</div>
    </div>
    <p className={cx.footnote}>Created {new Date(company.created_at).toLocaleDateString()}</p>
    <div className="mt-3">
      <AccordionCard summary="Members">
        <CompanyMembersList companyId={company.id} />
      </AccordionCard>
    </div>
  </div>
);

export const AdminCompaniesPage = () => {
  const { companies, loading, error, reload } = useAdminCompanies();

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No company workspaces yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {companies.map(c => <CompanyRow key={c.id} company={c} />)}
    </div>
  );
};
