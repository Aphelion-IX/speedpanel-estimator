// =============================================================================
// Company Team -- members screen
// =============================================================================
// Roster visible to every active member; invite/role/suspend/remove actions
// only rendered for owner/admin (server-side RLS/RPC checks are the real
// gate either way -- see supabase/schema.sql -- this is just not showing
// controls a plain member couldn't use). The roster + invite form + pending
// invitations block itself lives in CompanyMemberList.tsx, shared with
// Admin > Companies' per-company editor.
// =============================================================================
import { cx, BLUE } from "../../styleTokens";
import type { CompanyRole } from "./companyTypes";
import { StaffTeamCard } from "./StaffTeamCard";
import { CompanyMemberList } from "./CompanyMemberList";

export const CompanyTeamPage = ({ companyId, myUserId, myRole, onBack }: {
  companyId: string; myUserId: string; myRole: CompanyRole; onBack: () => void;
}) => {
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to projects</button>
      <h1 className={`${cx.h1} mt-3`}>Team</h1>

      <div className="mt-3">
        <StaffTeamCard companyId={companyId} />
      </div>

      <CompanyMemberList companyId={companyId} myUserId={myUserId} canManage={canManage} />
    </div>
  );
};
