// =============================================================================
// Admin gate
// =============================================================================
// Requires the caller to be signed in AND profiles.role = 'admin' --
// isInternalStaff/loading are AdminRoot.tsx's own useMyInternalRole() result,
// passed down rather than re-fetched here. This is genuinely UI-side-only
// defense in depth: the real boundary is server-side is_admin() on the Admin
// catalog tables' RLS policies (panels/tracks/fixings/sealants/colours/
// admin_documents/system_locked_rows/math_constants/system_tables -- see
// supabase/schema.sql), which reject a non-admin's writes regardless of
// whether this gate is bypassed. requests/projects are separately gated to
// auth.uid()/is_admin() at the RLS layer too, unrelated to this gate, since
// they hold customer PII (name/email/phone/project data).
// =============================================================================
import { NAVY, MUTED, cx } from "../styleTokens";
import { LoadingState } from "../ui/states";

export const AdminGate = ({ isInternalStaff, loading, children }: {
  isInternalStaff: boolean; loading: boolean; children: React.ReactNode;
}) => {
  if (loading) return <LoadingState className="mt-6" label="Checking access" />;
  if (!isInternalStaff) {
    return (
      <div className={`${cx.card} mt-3`}>
        <p className="text-sm font-semibold" style={{ color: NAVY }}>Not authorized</p>
        <p className={cx.footnote} style={{ paddingTop: 0, color: MUTED }}>
          The Admin section is only available to Speedpanel staff accounts.
        </p>
      </div>
    );
  }
  return <>{children}</>;
};
