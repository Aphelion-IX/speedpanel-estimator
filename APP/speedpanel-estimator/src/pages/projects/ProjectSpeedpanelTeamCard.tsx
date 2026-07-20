// =============================================================================
// Your Speedpanel Team -- compact, read-only panel on the project dashboard
// =============================================================================
// Same data as StaffTeamCard.tsx (company/CompanyTeamPage.tsx) but a
// denser layout for the project dashboard's CardGrid, with real mailto:/
// tel: links for the single-assignment contacts. No "Message" button --
// this app has no in-app messaging system to send one through.
// =============================================================================
import { Mail, Phone, Users } from "lucide-react";
import { cx, NAVY, BLUE } from "../../styleTokens";
import { Card } from "../../ui/primitives";
import { LoadingState } from "../../ui/states";
import { STAFF_ROLES, STAFF_ROLE_LABELS, STAFF_ROLE_MULTI, staffDisplayName } from "../company/staffTypes";
import { useCompanyStaffTeam } from "../company/companyStore";

export const ProjectSpeedpanelTeamCard = ({ companyId }: { companyId: string }) => {
  const { staff, loading, error } = useCompanyStaffTeam(companyId);

  if (error) return null;

  return (
    <Card title="Your Speedpanel Team" icon={<Users size={14} />}>
      {loading ? (
        <LoadingState label="Loading your Speedpanel team" />
      ) : staff.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>Not assigned yet -- contact Speedpanel for help.</p>
      ) : (
        <div className="space-y-3">
          {STAFF_ROLES.map(role => {
            const members = staff.filter(m => m.role === role);
            if (members.length === 0) return null;
            if (STAFF_ROLE_MULTI[role]) {
              return (
                <div key={role} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{STAFF_ROLE_LABELS[role]}</span>
                  <span className={cx.footnote}>{members.length} team member{members.length === 1 ? "" : "s"}</span>
                </div>
              );
            }
            const contact = members[0];
            return (
              <div key={role} className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold" style={{ color: NAVY }}>{staffDisplayName(contact)}</div>
                  <p className={cx.footnote}>{STAFF_ROLE_LABELS[role]}</p>
                </div>
                <div className="flex items-center gap-2">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} title="Email" className="rounded-lg border border-slate-200 dark:border-slate-600 p-2" style={{ color: BLUE }}>
                      <Mail size={14} />
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} title="Call" className="rounded-lg border border-slate-200 dark:border-slate-600 p-2" style={{ color: BLUE }}>
                      <Phone size={14} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
