// =============================================================================
// Admin section access -- which internal staff roles see which sections
// =============================================================================
// Mirrors the server-side gating table in supabase/schema.sql's "Internal
// staff roles" migration comment -- this file only controls what renders
// client-side (hidden tiles on AdminDashboard.tsx, blocked direct
// navigation in AdminRoot.tsx); the real enforcement for the sections that
// matter (Users, Companies, Analytics, Audit Log, Project Reviews, Orders,
// Manufacturing, Requests) already lives in the specific RPCs/policies that
// call has_staff_role(). Sections omitted from SECTION_ROLES (Products,
// Systems, Maths, Documents, Users, Companies, Analytics, Audit Log) are
// super_admin/null only -- see that migration's "Explicitly NOT touched"
// note for why catalog writes and Analytics' underlying queries stay
// un-narrowed server-side even though they're nav-hidden here.
// =============================================================================
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { StaffRole, InternalRole } from "../company/staffTypes";

const SECTION_ROLES: Partial<Record<AdminSubPage, StaffRole[]>> = {
  requests: ["bdm"],
  projectReviews: ["project_manager", "technical_services"],
  orders: ["internal_sales"],
  manufacturing: ["dispatch"],
  myAssignments: ["project_manager", "bdm", "internal_sales", "dispatch", "technical_services"],
};

// null/undefined (not yet assigned) and 'super_admin' always pass, matching
// has_staff_role()'s own grandfather logic server-side. "dashboard" itself
// is always reachable -- individual tiles are filtered instead of the whole
// page being blocked.
export function canAccessSection(myRole: InternalRole | null, section: AdminSubPage): boolean {
  if (section === "dashboard") return true;
  if (myRole === null || myRole === "super_admin") return true;
  const allowed = SECTION_ROLES[section];
  if (!allowed) return false;
  return allowed.includes(myRole as StaffRole);
}
