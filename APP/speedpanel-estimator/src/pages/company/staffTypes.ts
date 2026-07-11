// =============================================================================
// Assigned Speedpanel Team -- row types
// =============================================================================
// Mirrors supabase/schema.sql's "Assigned Speedpanel Team" section --
// staff_assignments, plus the company_list_staff_team()/
// admin_list_staff_candidates() RPC return shapes. StaffRole is a distinct
// type from CompanyRole (companyTypes.ts) on purpose: 'project_manager' and
// 'bdm' here mean a Speedpanel employee assigned to a customer relationship,
// not the customer's own company_memberships role of the same name -- never
// conflate the two, even though the label collides.
// =============================================================================
import { z } from "zod";

export const STAFF_ROLES = ["project_manager", "bdm", "internal_sales", "dispatch", "technical_services"] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  project_manager: "Project Manager",
  bdm: "Business Development Manager",
  internal_sales: "Internal Sales",
  dispatch: "Dispatch",
  technical_services: "Technical Services",
};

// true = "Multiple Assignment" (a department -- several staff may hold this
// role for the same company); false = "Single Assignment" (a relationship
// owner -- staff_assignments_single_role_idx enforces this at the DB level
// too, not just here).
export const STAFF_ROLE_MULTI: Record<StaffRole, boolean> = {
  project_manager: false,
  bdm: false,
  internal_sales: true,
  dispatch: true,
  technical_services: true,
};

// company_list_staff_team() RPC row shape.
export const StaffTeamMemberRowSchema = z.object({
  staff_user_id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  title: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.enum(STAFF_ROLES),
  is_primary: z.boolean(),
});
export type StaffTeamMemberRow = z.infer<typeof StaffTeamMemberRowSchema>;

// admin_list_staff_candidates() RPC row shape -- the picker source for
// assigning staff to a company.
export const StaffCandidateRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  title: z.string().nullable(),
  staff_role: z.string().nullable(),
});
export type StaffCandidateRow = z.infer<typeof StaffCandidateRowSchema>;

// Every internal Speedpanel staff account has exactly one of these --
// profiles.staff_role. Every StaffRole is also a valid InternalRole (a
// person's job function doubles as which Assigned Team role they're
// eligible to hold on a company), plus 'super_admin', which isn't itself an
// assignable company relationship -- see has_staff_role() in
// supabase/schema.sql.
export const INTERNAL_ROLES = [...STAFF_ROLES, "super_admin"] as const;
export type InternalRole = typeof INTERNAL_ROLES[number];

export const INTERNAL_ROLE_LABELS: Record<InternalRole, string> = {
  ...STAFF_ROLE_LABELS,
  super_admin: "Super Admin",
};

// Best display name for a staff contact -- falls back through display_name
// -> email -> raw id, same "never show a blank" convention as email
// fallbacks elsewhere in this app.
export function staffDisplayName(row: { display_name: string | null; email: string | null }): string {
  return row.display_name || row.email || "(unknown)";
}
