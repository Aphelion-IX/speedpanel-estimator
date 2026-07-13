// =============================================================================
// Admin Roles -- permission matrix row types
// =============================================================================
// Mirrors admin_list_permission_matrix()'s return shape (see
// supabase/schema.sql's "Dynamic RBAC" section) -- one row per
// (permission_key, role) pair, cross-joined server-side against every
// StaffRole (never 'super_admin', see that RPC's own comment for why: the
// grandfather clause already gives it unconditional access, so a grant row
// for it would be both meaningless and misleading as an editable checkbox).
// =============================================================================
import { z } from "zod";
import { STAFF_ROLES } from "../../company/staffTypes";

export const PermissionMatrixRowSchema = z.object({
  permission_key: z.string(),
  description: z.string(),
  category: z.string(),
  role: z.enum(STAFF_ROLES),
  granted: z.boolean(),
});
export type PermissionMatrixRow = z.infer<typeof PermissionMatrixRowSchema>;
