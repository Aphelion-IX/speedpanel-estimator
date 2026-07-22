// =============================================================================
// Company Accounts & Pricing -- Audit History (standalone, Phase 13)
// =============================================================================
// Cross-company sibling of AdminAuditLogPage.tsx (that one is a fixed
// install/technical-review feed off project_stage_events; this one is the
// general company_id-scoped audit_logs table -- role changes, price list
// assignments, overrides, status changes, invitations, orders, etc.).
// Backed by admin_list_audit_log() (see auditStore.ts), audit.list_all-
// gated (super_admin-only by default, same as companies.list) -- a role
// without that grant sees an empty feed rather than an error, consistent
// with every other has_permission()-folded-into-WHERE RPC in this module.
//
// event_type reuses companyTypes.ts's EVENT_TYPE_LABELS -- every event this
// page can show is already logged through that same map's call sites (see
// supabase/schema.sql's log_audit() call sites), so there's one label
// source of truth, not a duplicate.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED, tone } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { useAdminAuditHistory } from "./auditStore";
import { eventLabel, SORTED_EVENT_TYPES } from "./auditTypes";
import { AuditEventCard } from "./AuditEventCard";
import { useAdminCompanies } from "../../admin/companies/companiesStore";

const RequiredAuditDataPanel = () => (
  <section className={cx.card}>
    <h2 className={cx.h3}>What every audit entry captures</h2>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>
      Every row this page shows is written by the same shared <code>log_audit()</code> function (see
      <code> supabase/schema.sql</code>), so this list is a guarantee, not a per-event checklist:
    </p>
    <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm" style={{ color: NAVY }}>
      <li><strong>Who</strong> -- the acting user (<code>actor_id</code>/<code>actor_email</code>), resolved from a real signed-in session, never client-supplied.</li>
      <li><strong>When</strong> -- <code>created_at</code>, server-assigned at insert time.</li>
      <li><strong>What</strong> -- a fixed <code>event_type</code> from the catalog above, plus a <code>detail</code> jsonb payload carrying the event's own before/after values (role changed, price changed, status changed, etc.).</li>
      <li><strong>Where</strong> -- the owning company always, and the affected project/target user where the event has one.</li>
    </ul>
    <p className="mt-3 text-sm" style={{ color: MUTED }}>
      Rows are append-only -- <code>audit_logs</code> has no update/delete policy for any role; the only writer is
      <code> log_audit()</code> itself, a security-definer function every other RPC in this module calls, never a
      direct insert.
    </p>
  </section>
);

export const AuditHistoryPage = () => {
  const { companies } = useAdminCompanies();
  const [companyId, setCompanyId] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const { events, loading, loadingMore, hasMore, error, reload, loadMore } =
    useAdminAuditHistory(companyId === "all" ? null : companyId, eventType === "all" ? null : eventType);

  return (
    <div>
      <span className={cx.eyebrow}>Account Management</span>
      <h1 className={cx.h1 + " mt-1"}>Audit History</h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: MUTED }}>
        Every logged action across every company workspace -- role changes, pricing changes, status changes,
        invitations, and orders.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={cx.input + " w-auto"}>
          <option value="all">All companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={eventType} onChange={e => setEventType(e.target.value)} className={cx.input + " w-auto"}>
          <option value="all">All event types</option>
          {SORTED_EVENT_TYPES.map(t => <option key={t} value={t}>{eventLabel(t)}</option>)}
        </select>
        <span className={`${cx.badge} ${tone("neutral")}`}>{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {loading && <LoadingState className="mt-2" label="Loading audit history" />}
          {!loading && error && <ErrorState className="mt-2" message={error} onRetry={() => reload()} />}
          {!loading && !error && events.length === 0 && (
            <EmptyState className={`${cx.card} mt-2 text-center`} message="No audit activity matches these filters." />
          )}
          {!loading && !error && events.map(row => <AuditEventCard key={row.id} row={row} />)}

          {!loading && !error && hasMore && (
            <Button variant="secondary" className="w-full mt-3" onClick={() => loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>

        <RequiredAuditDataPanel />
      </div>
    </div>
  );
};
