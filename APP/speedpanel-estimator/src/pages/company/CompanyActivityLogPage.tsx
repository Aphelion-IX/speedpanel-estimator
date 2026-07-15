// =============================================================================
// Company Activity Log
// =============================================================================
// Paginated feed of audit_logs for one company (see supabase/schema.sql) --
// same shape as admin/AdminAuditLogPage.tsx's "Load more" pagination.
// owner/admin only (is_company_admin()-gated server-side by
// company_list_audit_log itself).
// =============================================================================
import { cx, NAVY, BLUE } from "../../styleTokens";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { useCompanyAuditLog } from "./companyStore";
import { EVENT_TYPE_LABELS, type AuditLogRow } from "./companyTypes";

const describe = (event: AuditLogRow): string => {
  const actor = event.actor_email ?? "Someone";
  const label = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
  const target = event.target_email ? ` -- ${event.target_email}` : "";
  const project = event.project_name ? ` (${event.project_name})` : "";
  return `${actor}: ${label}${target}${project}`;
};

export const CompanyActivityLogPage = ({ companyId, onBack }: { companyId: string; onBack: () => void }) => {
  const { events, loading, loadingMore, hasMore, error, reload, loadMore } = useCompanyAuditLog(companyId);

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to projects</button>
      <h1 className={`${cx.h1} mt-3`}>Activity Log</h1>

      {loading && <LoadingState className="mt-3" label="Loading activity" />}

      {!loading && error && (
        <ErrorState className="mt-3" message={error} onRetry={() => reload()} />
      )}

      {!loading && !error && events.length === 0 && (
        <EmptyState className="mt-3 text-center" message="No activity yet." />
      )}

      {!loading && !error && events.map(event => (
        <div key={event.id} className={`${cx.card} mt-3`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: NAVY }}>{describe(event)}</p>
            <span className={cx.footnote}>{new Date(event.created_at).toLocaleString()}</span>
          </div>
        </div>
      ))}

      {!loading && !error && hasMore && (
        <Button variant="secondary" onClick={() => loadMore()} disabled={loadingMore} className="mt-3 w-full">
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
};
