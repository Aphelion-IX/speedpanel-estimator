// =============================================================================
// Company workspaces -- row types
// =============================================================================
// Mirrors supabase/schema.sql's "Multi-user company workspaces" section --
// companies/company_memberships/invitations/project_memberships/audit_logs,
// plus the RPC return shapes (company_list_members/company_list_audit_log)
// that don't map 1:1 onto a single table. Same snake_case + Zod-schema-per-
// row convention as projectTypes.ts/orderTypes.ts.
// =============================================================================
import { z } from "zod";

export const COMPANY_ROLES = ["owner", "admin", "project_manager", "estimator", "site_user", "viewer"] as const;
export type CompanyRole = typeof COMPANY_ROLES[number];

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  admin: "Admin",
  project_manager: "Project Manager",
  estimator: "Estimator",
  site_user: "Site User",
  viewer: "Viewer",
};

export const MEMBERSHIP_STATUSES = ["active", "suspended", "removed"] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const MEMBERSHIP_STATUS_BADGE_CLASS: Record<MembershipStatus, string> = {
  active: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
  suspended: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  removed: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
};

export const CompanyRowSchema = z.object({
  id: z.string(),
  legal_name: z.string(),
  trading_name: z.string().nullable(),
  abn: z.string().nullable(),
  customer_account_number: z.string().nullable(),
  billing_email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  status: z.enum(["active", "suspended", "closed"]),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CompanyRow = z.infer<typeof CompanyRowSchema>;

// A plain table read (company_memberships' own "Members can read their own
// membership rows" RLS policy already covers "where user_id = auth.uid()"),
// embedding the company name via the company_id FK -- no RPC needed for
// "which companies am I in".
export const MyCompanyMembershipRowSchema = z.object({
  company_id: z.string(),
  role: z.enum(COMPANY_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  companies: z.object({ legal_name: z.string(), trading_name: z.string().nullable() }).nullable(),
});
export type MyCompanyMembership = z.infer<typeof MyCompanyMembershipRowSchema>;

// company_list_members() RPC row shape.
export const CompanyMemberRowSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  role: z.enum(COMPANY_ROLES),
  status: z.enum(MEMBERSHIP_STATUSES),
  joined_at: z.string(),
  last_active_at: z.string().nullable(),
  assigned_project_count: z.number(),
});
export type CompanyMemberRow = z.infer<typeof CompanyMemberRowSchema>;

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "cancelled"] as const;
export type InvitationStatus = typeof INVITATION_STATUSES[number];

export const InvitationRowSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  email: z.string(),
  invitee_name: z.string().nullable(),
  role: z.enum(COMPANY_ROLES),
  status: z.enum(INVITATION_STATUSES),
  invited_by: z.string(),
  message: z.string().nullable(),
  project_ids: z.array(z.string()).nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  accepted_at: z.string().nullable(),
});
export type InvitationRow = z.infer<typeof InvitationRowSchema>;

export const PROJECT_ROLES = ["editor", "viewer"] as const;
export type ProjectRole = typeof PROJECT_ROLES[number];

export const ProjectMembershipRowSchema = z.object({
  project_id: z.string(),
  user_id: z.string(),
  project_role: z.enum(PROJECT_ROLES),
  added_by: z.string().nullable(),
  added_at: z.string(),
});
export type ProjectMembershipRow = z.infer<typeof ProjectMembershipRowSchema>;

// company_list_audit_log() RPC row shape.
export const AuditLogRowSchema = z.object({
  id: z.string(),
  actor_id: z.string().nullable(),
  actor_email: z.string().nullable(),
  event_type: z.string(),
  target_user_id: z.string().nullable(),
  target_email: z.string().nullable(),
  project_id: z.string().nullable(),
  project_name: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
});
export type AuditLogRow = z.infer<typeof AuditLogRowSchema>;

// Covers every event_type any RPC/trigger in schema.sql's company-workspace
// section can log -- an unrecognized value (there shouldn't be one) falls
// back to the raw event_type string at the call site, not here.
export const EVENT_TYPE_LABELS: Record<string, string> = {
  company_created: "Company created",
  project_created: "Project created",
  order_submitted: "Order submitted",
  proforma_requested: "Pro forma invoice requested",
  delivery_requested: "Delivery added",
  install_review_requested: "Install review requested",
  install_review_approved: "Install review approved",
  install_review_changes_requested: "Install review changes requested",
  technical_review_requested: "Technical review requested",
  technical_review_approved: "Technical review approved",
  technical_review_changes_requested: "Technical review changes requested",
  invitation_accepted: "Invitation accepted",
  role_changed: "Role changed",
  member_status_changed: "Member status changed",
  member_removed: "Member removed",
  member_added_by_admin: "Added by Speedpanel admin",
  project_reassigned: "Project access changed",
  staff_assignment_added: "Speedpanel team member assigned",
  staff_assignment_removed: "Speedpanel team member removed",
};
