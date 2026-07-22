// =============================================================================
// Company Accounts & Pricing -- per-company Audit tab (Phase 14)
// =============================================================================
// Replaces the stale "coming in Phase 13" placeholder this tab used to
// render -- Phase 13 shipped Audit History as its own standalone
// cross-company page (AuditHistoryPage.tsx) rather than a per-company tab,
// so this wasn't wired automatically once that phase landed. Reuses the
// same useAdminAuditHistory() hook/admin_list_audit_log() RPC, pre-scoped
// to this one company (no company picker needed -- it's already fixed by
// the page this tab lives on), event-type filter only.
// =============================================================================
import { useState } from "react";
import { cx, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { useAdminAuditHistory } from "../audit/auditStore";
import { eventLabel, SORTED_EVENT_TYPES } from "../audit/auditTypes";
import { AuditEventCard } from "../audit/AuditEventCard";

export const CompanyAuditTab = ({ companyId }: { companyId: string }) => {
  const [eventType, setEventType] = useState<string>("all");
  const { events, loading, loadingMore, hasMore, error, reload, loadMore } =
    useAdminAuditHistory(companyId, eventType === "all" ? null : eventType);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: MUTED }}>Every logged action for this company -- role changes, pricing changes, status changes, invitations, and orders.</p>
        <select value={eventType} onChange={e => setEventType(e.target.value)} className={cx.input + " w-auto"}>
          <option value="all">All event types</option>
          {SORTED_EVENT_TYPES.map(t => <option key={t} value={t}>{eventLabel(t)}</option>)}
        </select>
      </div>

      {loading && <LoadingState className="mt-4" label="Loading audit history" />}
      {!loading && error && <ErrorState className="mt-4" message={error} onRetry={() => reload()} />}
      {!loading && !error && events.length === 0 && (
        <EmptyState className={`${cx.card} mt-4 text-center`} message="No audit activity for this company yet." />
      )}

      {!loading && !error && events.map(row => <AuditEventCard key={row.id} row={row} showCompany={false} />)}

      {!loading && !error && hasMore && (
        <Button variant="secondary" className="w-full mt-3" onClick={() => loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
};
