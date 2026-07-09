// =============================================================================
// Admin gate
// =============================================================================
// Intentionally open -- no role check, no sign-in requirement. The Admin
// catalog tables (panels/tracks/fixings/sealants/colours/admin_documents/
// system_locked_rows/math_constants) have matching public write RLS policies
// (see supabase/schema.sql) so this is consistent end to end, not just a
// client-side skip. requests/projects are NOT part of this -- those still
// require auth.uid()/is_admin() at the RLS layer regardless of this gate,
// since they hold customer PII (name/email/phone/project data).
// =============================================================================
export const AdminGate = ({ children }: { children: React.ReactNode }) => <>{children}</>;
