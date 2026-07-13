// =============================================================================
// Admin section access -- which internal staff roles see which sections
// =============================================================================
// Nav visibility is now DB-backed (role_permissions, an admin.section.*
// permission_key per section) instead of a hardcoded map -- a super_admin
// edits this live from Admin > Roles (AdminRolesPage.tsx) rather than a code
// deploy. This file only controls what renders client-side (hidden tiles on
// AdminDashboard.tsx, blocked direct navigation in AdminRoot.tsx); the real
// enforcement for the sections that matter already lives in the specific
// RPCs/policies that call has_permission() (see supabase/schema.sql's
// "Dynamic RBAC" section). Sections with no admin.section.* grants seeded
// for any role (Catalog: Products, Systems, Maths, Documents; People: Users,
// Companies, Permissions; Reports: Analytics, Audit Log) are super_admin/null
// only by default -- see that section's own seed comment for why catalog
// writes and Analytics' underlying queries stay un-narrowed server-side even
// though they're nav-hidden here.
//
// "permissions" is kept as the internal AdminSubPage/permission_key name for
// URL stability (#/admin/permissions keeps working) even though the section
// itself is labeled "Roles" in the UI -- see AdminRolesPage.tsx.
// =============================================================================
import type { AdminSubPage } from "../../appShell/useHashRoute";
import type { InternalRole } from "../company/staffTypes";

const SECTION_PERMISSION_KEYS: Record<Exclude<AdminSubPage, "dashboard">, string> = {
  requests: "admin.section.requests",
  projectReviews: "admin.section.projectReviews",
  orders: "admin.section.orders",
  deliveryRequests: "admin.section.deliveryRequests",
  manufacturing: "admin.section.manufacturing",
  users: "admin.section.users",
  companies: "admin.section.companies",
  permissions: "admin.section.permissions",
  analytics: "admin.section.analytics",
  auditLog: "admin.section.auditLog",
  products: "admin.section.products",
  priceLists: "admin.section.priceLists",
  systems: "admin.section.systems",
  maths: "admin.section.maths",
  documents: "admin.section.documents",
};

// null/undefined (not yet assigned) and 'super_admin' always pass, matching
// has_permission()'s own grandfather logic server-side. "dashboard" itself
// is always reachable -- individual tiles are filtered instead of the whole
// page being blocked. myPermissions is the caller's own role_permissions
// grant set (see useMyInternalRole.ts) -- this function stays a pure lookup
// over it, no fetching here.
export function canAccessSection(myRole: InternalRole | null, myPermissions: ReadonlySet<string>, section: AdminSubPage): boolean {
  if (section === "dashboard") return true;
  if (myRole === null || myRole === "super_admin") return true;
  return myPermissions.has(SECTION_PERMISSION_KEYS[section as Exclude<AdminSubPage, "dashboard">]);
}
