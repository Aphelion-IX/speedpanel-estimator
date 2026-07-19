// =============================================================================
// Admin > Support Requests -- triage/respond to customer service requests
// =============================================================================
// List (search + status/type filters) + a status dropdown per row, same
// "wide, text-heavy rows" shape as AdminRequestsPage.tsx. Opening a row's
// "View thread" reuses ServiceRequestDetailDrawer.tsx (the exact same
// component the customer side renders) with viewerKind="staff" and a
// statusControl -- one thread UI for both sides, see that component's own
// header comment.
// =============================================================================
import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { cx, NAVY, MUTED } from "../../../styleTokens";
import { SelectField } from "../../shared/fields";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import { ErrorDialog } from "../../../ui/confirmDialog";
import { ServiceRequestDetailDrawer } from "../../projects/services/ServiceRequestDetailDrawer";
import { useAdminServiceRequests, type AdminServiceRequestRow } from "./adminServiceRequestsStore";
import {
  SERVICE_REQUEST_TYPES, SERVICE_REQUEST_TYPE_LABELS,
  SERVICE_REQUEST_STATUSES, SERVICE_REQUEST_STATUS_LABELS, SERVICE_REQUEST_STATUS_BADGE_CLASS,
  type ServiceRequestStatus, type ServiceRequestType,
} from "../../projects/services/serviceRequestTypes";
import type { EffectiveLayout } from "../../../useLayoutMode";

const TYPE_FILTER_OPTIONS = [{ value: "all", label: "All types" }, ...SERVICE_REQUEST_TYPES.map(t => ({ value: t, label: SERVICE_REQUEST_TYPE_LABELS[t] }))];
const STATUS_FILTER_OPTIONS = [{ value: "all", label: "All statuses" }, ...SERVICE_REQUEST_STATUSES.map(s => ({ value: s, label: SERVICE_REQUEST_STATUS_LABELS[s] }))];
const STATUS_UPDATE_OPTIONS = (["assigned", "under_review", "info_required", "response_issued", "closed"] as ServiceRequestStatus[])
  .map(s => ({ value: s, label: SERVICE_REQUEST_STATUS_LABELS[s] }));

const RequestRow = ({ item, onStatusChange, onOpen }: {
  item: AdminServiceRequestRow; onStatusChange: (id: string, status: ServiceRequestStatus) => void; onOpen: () => void;
}) => (
  <div className={`${cx.card} mt-3`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <button onClick={onOpen} className="text-left">
        <div className="text-sm font-bold" style={{ color: NAVY }}>{SERVICE_REQUEST_TYPE_LABELS[item.request_type]}</div>
        <div className="mt-0.5 text-xs" style={{ color: MUTED }}>
          {item.projects?.name ?? "Unknown project"}{item.projects?.project_number ? ` · ${item.projects.project_number}` : ""}
        </div>
      </button>
      <span className={`${cx.badge} ${SERVICE_REQUEST_STATUS_BADGE_CLASS[item.status]}`}>{SERVICE_REQUEST_STATUS_LABELS[item.status]}</span>
    </div>
    {item.question && <p className="mt-2 text-sm" style={{ color: NAVY }}>{item.question}</p>}
    {item.description && <p className="mt-1 text-sm" style={{ color: MUTED }}>{item.description}</p>}
    <p className={cx.footnote}>{new Date(item.created_at).toLocaleString()}</p>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="max-w-[220px]">
        <SelectField label="Status" value={item.status} options={STATUS_UPDATE_OPTIONS} onChange={v => onStatusChange(item.id, v as ServiceRequestStatus)} />
      </div>
      <button onClick={onOpen} className="text-sm font-bold" style={{ color: NAVY }}>View thread &rarr;</button>
    </div>
  </div>
);

export const AdminServiceRequestsPage = ({ layoutMode, userId }: { layoutMode: EffectiveLayout; userId: string | null }) => {
  const { requests, loading, error, reload, updateStatus } = useAdminServiceRequests();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ServiceRequestType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ServiceRequestStatus>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState<AdminServiceRequestRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(r => {
      if (typeFilter !== "all" && r.request_type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.projects?.name ?? "", r.projects?.project_number ?? "", r.question ?? "", r.description ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [requests, typeFilter, statusFilter, query]);

  const handleStatusChange = async (id: string, status: ServiceRequestStatus) => {
    const err = await updateStatus(id, status);
    if (err) setActionError(err);
  };

  if (loading) return <LoadingState className="mt-6" label="Loading support requests" />;
  if (error) return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;

  return (
    <div className="mt-2">
      <ErrorDialog message={actionError} onDismiss={() => setActionError(null)} />
      <div className="flex items-center gap-2">
        <MessageSquare size={16} style={{ color: NAVY }} />
        <h1 className={cx.h1}>Support Requests</h1>
      </div>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>Technical Review, Pre-Start Meeting, Installation Review and Product Warranty requests across every project.</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm">
          <Search size={16} className="shrink-0" style={{ color: MUTED }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search project, question, description..."
            className="w-full bg-transparent text-sm outline-none" style={{ color: NAVY }} />
        </div>
        <div className="sm:w-52"><SelectField label="Type" value={typeFilter} options={TYPE_FILTER_OPTIONS} onChange={v => setTypeFilter(v as typeof typeFilter)} /></div>
        <div className="sm:w-52"><SelectField label="Status" value={statusFilter} options={STATUS_FILTER_OPTIONS} onChange={v => setStatusFilter(v as typeof statusFilter)} /></div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState className={`${cx.card} mt-3 text-center`} message="No support requests match your filters." />
      ) : (
        filtered.map(item => <RequestRow key={item.id} item={item} onStatusChange={handleStatusChange} onOpen={() => setOpenRequest(item)} />)
      )}

      {openRequest && (
        <ServiceRequestDetailDrawer request={openRequest} userId={userId} layoutMode={layoutMode} viewerKind="staff"
          statusControl={
            <div className="max-w-[220px]">
              <SelectField label="Status" value={openRequest.status} options={STATUS_UPDATE_OPTIONS}
                onChange={v => { handleStatusChange(openRequest.id, v as ServiceRequestStatus); setOpenRequest({ ...openRequest, status: v as ServiceRequestStatus }); }} />
            </div>
          }
          onClose={() => setOpenRequest(null)}
        />
      )}
    </div>
  );
};
