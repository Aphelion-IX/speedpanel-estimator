// =============================================================================
// Admin > Companies -- create and manage every company workspace
// =============================================================================
// "+ New company" launches AdminCompanyWizard.tsx -- the only way a company
// gets created now (self-service create_company() was removed, see
// supabase/schema.sql's "Company-creation cutover"). Each existing company
// expands into two accordion sections: "Members" (CompanyMemberList.tsx,
// the same roster+invite/role/suspend/remove controls the customer-facing
// Team page uses, now reachable here thanks to is_company_admin's
// is_admin() bypass) and "Speedpanel Team" (StaffTeamAssignmentPanel.tsx --
// the actual new feature this page exists to support).
// =============================================================================
import { useState } from "react";
import { Plus } from "lucide-react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import type { UseAuth } from "../../lib/useAuth";
import { useAdminCompanies, type AdminCompanyRow } from "./companies/companiesStore";
import { AdminCompanyWizard } from "./companies/AdminCompanyWizard";
import { StaffTeamAssignmentPanel } from "./companies/StaffTeamAssignmentPanel";
import { CompanyMemberList } from "../company/CompanyMemberList";

const CompanyRow = ({ company, myUserId }: { company: AdminCompanyRow; myUserId: string | null }) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-bold" style={{ color: NAVY }}>{company.name}</div>
      <div className={cx.footnote}>{company.member_count} member{company.member_count === 1 ? "" : "s"}</div>
    </div>
    <p className={cx.footnote}>Created {new Date(company.created_at).toLocaleDateString()}</p>
    <div className="mt-3 space-y-2">
      <AccordionCard summary="Members">
        <CompanyMemberList companyId={company.id} myUserId={myUserId} canManage={true} />
      </AccordionCard>
      <AccordionCard summary="Speedpanel Team">
        <StaffTeamAssignmentPanel companyId={company.id} />
      </AccordionCard>
    </div>
  </div>
);

export const AdminCompaniesPage = ({ auth }: { auth: UseAuth }) => {
  const { companies, loading, error, reload } = useAdminCompanies();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Companies</h1>
        {!creating && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
            <Plus size={15} /> New company
          </button>
        )}
      </div>

      {creating && (
        <AdminCompanyWizard
          onFinished={() => { setCreating(false); reload(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {loading && <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>}

      {!loading && error && (
        <div className={`${cx.card} mt-6`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
        </div>
      )}

      {!loading && !error && companies.length === 0 && !creating && (
        <div className={`${cx.card} mt-6 text-center`}>
          <p className={cx.footnote}>No company workspaces yet.</p>
        </div>
      )}

      {!loading && !error && companies.map(c => <CompanyRow key={c.id} company={c} myUserId={auth.user?.id ?? null} />)}
    </div>
  );
};
