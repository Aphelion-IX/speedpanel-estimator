// =============================================================================
// Admin > Audit Log -- install/technical review history
// =============================================================================
// Read-only feed of project_stage_events (see AdminProjectsPage.tsx for the
// review actions that generate these rows) -- newest first, one row per
// event, no per-row interaction.
// =============================================================================
import { cx, NAVY, MUTED } from "../../styleTokens";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { useAdminAuditLog } from "./auditLog/auditLogStore";
import { STAGE_EVENT_LABELS } from "./auditLog/auditLogTypes";

export const AdminAuditLogPage = () => {
  const { events, loading, loadingMore, hasMore, error, reload, loadMore } = useAdminAuditLog();

  if (loading) {
    return <LoadingState className="mt-6" label="Loading audit log" />;
  }

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  if (events.length === 0) {
    return <EmptyState className={`${cx.card} mt-6 text-center`} message="No review activity yet." />;
  }

  return (
    <div className="mt-2">
      {events.map(item => (
        <div key={item.id} className={`${cx.card} mt-3`}>
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-bold" style={{ color: NAVY }}>{item.project_name}</div>
            <div className={cx.footnote}>{new Date(item.created_at).toLocaleString()}</div>
          </div>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            {STAGE_EVENT_LABELS[item.event_type]}{item.actor_email ? ` · ${item.actor_email}` : ""}
          </p>
          {item.note && <p className="mt-2 text-sm leading-relaxed" style={{ color: NAVY }}>{item.note}</p>}
        </div>
      ))}

      {hasMore && (
        <Button variant="secondary" className="w-full mt-3" onClick={() => loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
};
