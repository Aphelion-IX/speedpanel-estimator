// =============================================================================
// Company Accounts & Pricing -- cross-company Audit History row types
// =============================================================================
// Mirrors admin_list_audit_log()'s return shape (see supabase/schema.sql) --
// the staff-facing, cross-company sibling of company_list_audit_log()
// (companyTypes.ts's AuditLogRow), which stays per-company/is_company_admin()-
// gated for a company's own Users tab. event_type reuses companyTypes.ts's
// own EVENT_TYPE_LABELS map rather than duplicating it -- every event this
// page can show is logged via the same log_audit() call sites that map
// already covers.
// =============================================================================
import { z } from "zod";

export const AdminAuditLogRowSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  company_name: z.string(),
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
export type AdminAuditLogRow = z.infer<typeof AdminAuditLogRowSchema>;

// Only pricing_used_in_order rows carry an order_id (see create_order()'s
// own log_audit() call) -- narrowed out of the row's untyped `detail` where
// needed, rather than widening the whole row schema for one event type.
export function auditDetailOrderId(row: AdminAuditLogRow): string | null {
  const raw = row.detail?.order_id;
  return typeof raw === "string" ? raw : null;
}
