// =============================================================================
// Your Speedpanel Team -- read-only, customer-facing
// =============================================================================
// Grouped by role via company_list_staff_team() (see companyStore.ts's
// useCompanyStaffTeam). No edit controls at all, for anyone -- these are
// Speedpanel-managed relationships, not something even a company Owner can
// touch (see supabase/schema.sql's staff_assignments RLS: no write policy
// exists, only admin_set_staff_assignment/admin_remove_staff_assignment,
// both is_admin()-gated). The editable counterpart is
// StaffTeamAssignmentPanel.tsx, only ever rendered inside Admin.
// =============================================================================
import { User, Users } from "lucide-react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import { STAFF_ROLES, STAFF_ROLE_LABELS, STAFF_ROLE_MULTI, staffDisplayName, type StaffTeamMemberRow } from "./staffTypes";
import { useCompanyStaffTeam } from "./companyStore";

const SingleContactRow = ({ member }: { member: StaffTeamMemberRow }) => (
  <div className="flex items-start gap-2 py-2">
    <User size={16} className="mt-0.5 shrink-0" style={{ color: MUTED }} />
    <div>
      <div className="text-sm font-bold" style={{ color: NAVY }}>{staffDisplayName(member)}</div>
      <p className={cx.footnote}>{member.title || STAFF_ROLE_LABELS[member.role]}</p>
      {member.email && <p className={cx.footnote}>{member.email}</p>}
    </div>
  </div>
);

const TeamGroupRow = ({ role, members }: { role: string; members: StaffTeamMemberRow[] }) => (
  <div className="flex items-start gap-2 py-2">
    <Users size={16} className="mt-0.5 shrink-0" style={{ color: MUTED }} />
    <div>
      <div className="text-sm font-bold" style={{ color: NAVY }}>{STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS]}</div>
      <ul>
        {members.map(m => <li key={m.staff_user_id} className={cx.footnote}>{staffDisplayName(m)}</li>)}
      </ul>
    </div>
  </div>
);

export const StaffTeamCard = ({ companyId }: { companyId: string }) => {
  const { staff, loading, error } = useCompanyStaffTeam(companyId);

  if (loading) return null;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (staff.length === 0) return null;

  return (
    <div className={cx.card}>
      <h2 className={cx.h3}>Your Speedpanel Team</h2>
      <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        {STAFF_ROLES.map(role => {
          const members = staff.filter(m => m.role === role);
          if (members.length === 0) return null;
          return STAFF_ROLE_MULTI[role]
            ? <TeamGroupRow key={role} role={role} members={members} />
            : <SingleContactRow key={role} member={members[0]} />;
        })}
      </div>
    </div>
  );
};
