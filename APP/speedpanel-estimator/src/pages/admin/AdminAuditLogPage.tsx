// =============================================================================
// Admin > Audit Log -- install/technical review history
// =============================================================================
// Read-only feed of project_stage_events (see AdminProjectsPage.tsx for the
// review actions that generate these rows) -- newest first, one row per
// event, no per-row interaction.
// =============================================================================
import { cx, NAVY, MUTED } from "../../styleTokens";
import { useAdminAuditLog } from "./auditLog/auditLogStore";
import { STAGE_EVENT_LABELS } from "./auditLog/auditLogTypes";

export const AdminAuditLogPage = () => {
  const { events, loading, loadingMore, hasMore, error, reload, loadMore } = useAdminAuditLog();

  if (loading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No review activity yet.</p>
      </div>
    );
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
        <button onClick={() => loadMore()} disabled={loadingMore}
          className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ color: NAVY }}>
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
};
