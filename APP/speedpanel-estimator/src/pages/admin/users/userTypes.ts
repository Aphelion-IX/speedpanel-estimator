// =============================================================================
// Admin Users -- row types
// =============================================================================
// Mirrors admin_list_users()'s return shape (see supabase/schema.sql), not a
// table -- profiles has no email column, so this is an RPC row, not a select
// on profiles directly.
// =============================================================================
import { z } from "zod";

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = typeof USER_ROLES[number];

export const AdminUserRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  role: z.enum(USER_ROLES),
  created_at: z.string(),
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;
