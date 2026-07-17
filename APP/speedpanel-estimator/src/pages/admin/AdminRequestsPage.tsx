// =============================================================================
// Admin > Requests -- incoming quote/project submissions
// =============================================================================
// Read-mostly list (not the Products/Documents card-grid, not Systems' table
// editor -- wide, text-heavy rows) backed by a live Supabase read via
// useAdminRequests. Each row's only editable field is status; the attached
// project snapshot (if any) is shown as raw JSON in a collapsible section --
// admin reference data, not a polished view.
//
// Defaults to "My companies" scope for a bdm viewer (with a toggle to "All
// requests" -- see requestsStore.ts for why this is the one queue page that
// keeps a toggle instead of always scoping), and shows a "My companies"
// rollup panel above the search bar -- relocated from the now-deleted My
// Assignments page.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { ErrorDialog } from "../../ui/confirmDialog";
import { SelectField } from "../shared/fields";
import { useAdminRequests } from "./requests/requestsStore";
import { useMyBdmCompanies } from "./requests/myCompaniesStore";
import { REQUEST_STATUSES, REQUEST_STATUS_LABELS, type AdminRequestRow, type RequestStatus } from "../projects/requests/requestTypes";
import type { InternalRole } from "../company/staffTypes";

const SCOPE_OPTIONS = [{ value: "mine", label: "My companies" }, { value: "all", label: "All requests" }];

const STATUS_OPTIONS: { value: string; label: string }[] = REQUEST_STATUSES.map(s => ({ value: s, label: REQUEST_STATUS_LABELS[s] }));

const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...STATUS_OPTIONS];

const matchesQuery = (item: AdminRequestRow, q: string): boolean =>
  [item.name, item.email, item.phone ?? "", item.message ?? ""].some(f => f.toLowerCase().includes(q));

const RequestRow = ({ item, onStatusChange }: { item: AdminRequestRow; onStatusChange: (id: string, status: RequestStatus) => void }) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex items-start justify-between gap-2">
      <div className="text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
      <div className={cx.footnote}>{new Date(item.created_at).toLocaleString()}</div>
    </div>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>
      {item.email}{item.phone ? ` · ${item.phone}` : ""}
    </p>
    {item.message && <p className="mt-2 text-sm leading-relaxed" style={{ color: NAVY }}>{item.message}</p>}
    {item.project_id && <p className="mt-2 text-xs" style={{ color: MUTED }}>Linked project: {item.project_id}</p>}

    <div className="mt-3 max-w-[200px]">
      <SelectField label="Status" value={item.status} options={STATUS_OPTIONS}
        onChange={v => onStatusChange(item.id, v as RequestStatus)} />
    </div>

    {item.project_snapshot && (
      <div className="mt-3">
        <AccordionCard summary="Attached project">
          <pre className="overflow-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs">
            {JSON.stringify(item.project_snapshot, null, 2)}
          </pre>
        </AccordionCard>
      </div>
    )}
  </div>
);

const BdmCompaniesPanel = ({ companyIds }: { companyIds: string[] }) => {
  const { companies, loading } = useMyBdmCompanies(companyIds);
  if (loading || companies.length === 0) return null;
  return (
    <div className="mb-3">
      <div className={cx.cardHd}>My companies ({companies.length})</div>
      <div className="mt-2 space-y-2">
        {companies.map(c => (
          <div key={c.id} className={`${cx.card} flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-sm font-semibold" style={{ color: NAVY }}>{c.name}</span>
            <span className={cx.footnote}>
              {c.activeProjects} project{c.activeProjects === 1 ? "" : "s"} &middot; {c.activeOrders} order{c.activeOrders === 1 ? "" : "s"}
              {c.openRequests > 0 && <> &middot; {c.openRequests} attributed request{c.openRequests === 1 ? "" : "s"}</>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminRequestsPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { requests, scope, scopeMode, setScopeMode, canToggleScope, loading, loadingMore, hasMore, error, reload, loadMore, updateStatus } = useAdminRequests(userId, staffRole, staffRoleLoading);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(r => (statusFilter === "all" || r.status === statusFilter) && (!q || matchesQuery(r, q)));
  }, [requests, query, statusFilter]);

  const handleStatusChange = async (id: string, status: RequestStatus) => {
    const err = await updateStatus(id, status);
    if (err) setActionError(err);
  };

  const bdmPanel = staffRole === "bdm"
    ? <BdmCompaniesPanel companyIds={scope.kind === "companies" ? scope.companyIds : []} />
    : null;

  if (loading) {
    return <LoadingState className="mt-6" label="Loading requests" />;
  }

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  if (requests.length === 0) {
    return (
      <div className="mt-2">
        {bdmPanel}
        {canToggleScope && (
          <div className="sm:w-48"><SelectField label="Scope" value={scopeMode} options={SCOPE_OPTIONS} onChange={v => setScopeMode(v as "mine" | "all")} /></div>
        )}
        <EmptyState className={`${cx.card} mt-3 text-center`} message={`No requests ${scopeMode === "mine" && canToggleScope ? "for your companies " : ""}yet.`} />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <ErrorDialog message={actionError} onDismiss={() => setActionError(null)} />
      {bdmPanel}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0" style={{ color: MUTED }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone, message..."
            className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
        </div>
        <div className="sm:w-48">
          <SelectField label="Filter by status" value={statusFilter} options={STATUS_FILTER_OPTIONS} onChange={setStatusFilter} />
        </div>
        {canToggleScope && (
          <div className="sm:w-48"><SelectField label="Scope" value={scopeMode} options={SCOPE_OPTIONS} onChange={v => setScopeMode(v as "mine" | "all")} /></div>
        )}
      </div>
      {hasMore && query.trim() && (
        <p className="mt-2 text-xs" style={{ color: MUTED }}>Search only covers requests loaded so far -- load more below if you can't find who you're after.</p>
      )}

      {filtered.length === 0 ? (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No requests match your search." />
      ) : (
        filtered.map(item => <RequestRow key={item.id} item={item} onStatusChange={handleStatusChange} />)
      )}

      {hasMore && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
};
