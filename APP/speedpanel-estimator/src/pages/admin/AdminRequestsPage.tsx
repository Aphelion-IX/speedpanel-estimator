// =============================================================================
// Admin > Requests -- incoming quote/project submissions
// =============================================================================
// Read-mostly list (not the Products/Documents card-grid, not Systems' table
// editor -- wide, text-heavy rows) backed by a live Supabase read via
// useAdminRequests. Each row's only editable field is status; the attached
// project snapshot (if any) is shown as raw JSON in a collapsible section --
// admin reference data, not a polished view.
// =============================================================================
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, NAVY, MUTED } from "../../styleTokens";
import { AccordionCard } from "../../ui/primitives";
import { SelectField } from "../shared/fields";
import { useAdminRequests } from "./requests/requestsStore";
import type { AdminRequestRow, RequestStatus } from "./requests/requestTypes";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "closed", label: "Closed" },
];

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

export const AdminRequestsPage = () => {
  const { requests, loading, error, reload, updateStatus } = useAdminRequests();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(r => (statusFilter === "all" || r.status === statusFilter) && (!q || matchesQuery(r, q)));
  }, [requests, query, statusFilter]);

  const handleStatusChange = async (id: string, status: RequestStatus) => {
    const err = await updateStatus(id, status);
    if (err) window.alert(err);
  };

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

  if (requests.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No requests yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0" style={{ color: MUTED }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone, message..."
            className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
        </div>
        <div className="sm:w-48">
          <SelectField label="Filter by status" value={statusFilter} options={STATUS_FILTER_OPTIONS} onChange={setStatusFilter} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className={`${cx.card} mt-3 text-center`}>
          <p className={cx.footnote}>No requests match your search.</p>
        </div>
      ) : (
        filtered.map(item => <RequestRow key={item.id} item={item} onStatusChange={handleStatusChange} />)
      )}
    </div>
  );
};
