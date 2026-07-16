// =============================================================================
// Speedpanel Team assignment editor -- super_admin-only
// =============================================================================
// Shared between AdminCompanyWizard.tsx's step 3 and AdminCompaniesPage.tsx's
// per-company "Speedpanel Team" accordion -- same component, same
// useStaffAssignments(companyId) + useAdminStaffCandidates() (companiesStore.ts),
// both has_staff_role(array[])-gated server-side. Single-assignment roles
// (Project Manager, BDM) render as a radio list -- picking someone new
// automatically replaces the prior assignee (admin_set_staff_assignment
// enforces this via the staff_assignments_single_role_idx partial unique
// index, not just this UI). Multi-assignment roles (Internal Sales,
// Dispatch, Technical Services) render as checkboxes.
//
// Each role section's candidate list is filtered to people whose own
// internal staff_role matches (or who are super_admin) -- a BDM shouldn't
// normally show up as a pick for Dispatch. Anyone already assigned stays
// visible regardless (so an existing assignment from before staff_role
// existed, or a deliberate super_admin fill-in, can still be unassigned).
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { STAFF_ROLES, STAFF_ROLE_LABELS, STAFF_ROLE_MULTI, staffDisplayName, type StaffRole } from "../../company/staffTypes";
import { useAdminStaffCandidates, useStaffAssignments } from "./companiesStore";

export const StaffTeamAssignmentPanel = ({ companyId }: { companyId: string }) => {
  const { staff, loading: staffLoading, error: staffError, setAssignment, removeAssignment } = useStaffAssignments(companyId);
  const { candidates, loading: candidatesLoading, error: candidatesError } = useAdminStaffCandidates();
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setActionError(null);
    const err = await action();
    if (err) setActionError(err);
  };

  if (staffLoading || candidatesLoading) return <p className={cx.footnote}>Loading...</p>;
  if (staffError || candidatesError) return <p className="text-sm text-red-600 dark:text-red-300">{staffError || candidatesError}</p>;
  if (candidates.length === 0) return <p className={cx.footnote}>No Speedpanel admin accounts to assign yet.</p>;

  return (
    <div className="space-y-4">
      {actionError && <p className="text-sm text-red-600 dark:text-red-300">{actionError}</p>}
      {STAFF_ROLES.map(role => {
        const assigned = staff.filter(m => m.role === role);
        const multi = STAFF_ROLE_MULTI[role];
        const roleCandidates = candidates.filter(c =>
          c.staff_role === role || c.staff_role === "super_admin" || assigned.some(a => a.staff_user_id === c.id));
        return (
          <div key={role}>
            <label className={cx.lbl}>{STAFF_ROLE_LABELS[role]} -- {multi ? "choose one or more" : "choose one"}</label>
            <div className="mt-1 max-h-48 space-y-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-600 p-2">
              {roleCandidates.length === 0 && <p className="text-xs" style={{ color: MUTED }}>No staff with this internal role yet.</p>}
              {roleCandidates.map(c => {
                const isAssigned = assigned.some(a => a.staff_user_id === c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
                    <input
                      type={multi ? "checkbox" : "radio"}
                      name={multi ? undefined : `staff-${role}`}
                      checked={isAssigned}
                      onChange={() => {
                        if (isAssigned) {
                          run(() => removeAssignment(c.id, role as StaffRole));
                        } else {
                          run(() => setAssignment(c.id, role as StaffRole));
                        }
                      }}
                    />
                    {staffDisplayName({ display_name: c.display_name, email: c.email })}
                    {c.title && <span className={cx.footnote}> &middot; {c.title}</span>}
                  </label>
                );
              })}
            </div>
            {assigned.length === 0 && <p className="mt-1 text-xs" style={{ color: MUTED }}>Not assigned yet.</p>}
          </div>
        );
      })}
    </div>
  );
};
