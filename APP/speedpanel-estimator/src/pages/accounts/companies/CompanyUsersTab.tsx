// =============================================================================
// Company Accounts & Pricing -- Company Users tab (Phase 4)
// =============================================================================
// Wraps the existing CompanyMemberList.tsx (roster/invite/add-existing/
// role-change/suspend/reactivate/remove/resend/cancel -- already real,
// already tested) in this module's chrome, exactly the same component
// AdminCompaniesPage.tsx's old "Members" accordion used -- not a fork.
// canManage/isSpeedpanelAdmin are both unconditionally true: staff only
// reach this tab already gated on isInternalStaff (AccountsRoot.tsx's
// AdminGate), and CompanyMemberList's own RPCs are the real authorization
// boundary (is_company_admin()'s is_admin() bypass lets staff manage a
// company they were never added to as a member), same as the old
// Admin > Companies page's usage.
// =============================================================================
import { MUTED } from "../../../styleTokens";
import { CompanyMemberList } from "../../company/CompanyMemberList";

export const CompanyUsersTab = ({ companyId, myUserId }: { companyId: string; myUserId: string | null }) => (
  <div>
    <p className="text-sm" style={{ color: MUTED }}>
      Company user administration and invitation access -- primary user, administrators, project members and viewers for this company.
    </p>
    <div className="mt-4">
      <CompanyMemberList companyId={companyId} myUserId={myUserId} canManage={true} isSpeedpanelAdmin={true} />
    </div>
  </div>
);
