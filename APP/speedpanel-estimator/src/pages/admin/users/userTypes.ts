// =============================================================================
// Admin Users -- row types
// =============================================================================
// Mirrors admin_list_users()'s return shape (see supabase/schema.sql), not a
// table -- profiles has no email column, so this is an RPC row, not a select
// on profiles directly. admin_list_users() now only ever returns role='admin'
// rows (Admin > Users is a staff directory, not a general account list) --
// see AdminUsersPage.tsx.
// =============================================================================
import { z } from "zod";
import { INTERNAL_ROLES } from "../../company/staffTypes";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = typeof USER_ROLES[number];

export const AdminUserRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  created_at: z.string(),
  display_name: z.string().nullable(),
  title: z.string().nullable(),
  phone: z.string().nullable(),
  // Every row here is role='admin', so this is effectively always set once
  // an admin assigns it -- null only until someone does (grandfathered as
  // full access server-side, see has_staff_role() in supabase/schema.sql).
  staff_role: z.enum(INTERNAL_ROLES).nullable(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;
