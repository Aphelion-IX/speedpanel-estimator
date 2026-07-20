// =============================================================================
// Admin > Delivery Requests -- Internal Sales / Dispatch review queue
// =============================================================================
// The one admin section reachable by two staff roles at once (Internal
// Sales OR Dispatch, per the product spec) -- see adminSectionAccess.ts.
// Unlike AdminOrdersPage.tsx's narrow "awaiting a decision" queue, this
// lists every delivery request (including already-accepted/declined ones,
// and staff-created 'draft' split rows) since it's the one place staff edit
// delivery content/notes/splits at all, not just make a single approve/
// reject call -- closer to AdminManufacturingPage.tsx's "permanent record"
// posture than AdminOrdersPage.tsx's shrinking queue.
// =============================================================================
import { useState } from "react";
import {
  useAdminDeliveryRequests, type AdminDeliveryRequestRow,
} from "./adminDeliveryRequestsStore";
import { DELIVERY_APPROVAL_STATUS_LABELS, DELIVERY_AWAITING_DECISION_STATUSES, type DeliveryApprovalStatus } from "../../projects/orders/orderTypes";
import { AdminSplitDeliveryForm } from "./AdminSplitDeliveryForm";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import type { InternalRole } from "../../company/staffTypes";
import "../../order/ordersTheme.css";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "--");

const DELIVERY_APPROVAL_ORD_TONE: Record<DeliveryApprovalStatus, string> = {
  draft: "neutral", pending: "attention", accepted: "green", date_proposed: "attention", declined: "red",
};

type SplitInput = {
  addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
  contactName?: string; contactPhone?: string; requestedDate?: string; deliveryInstructions?: string;
  preferredWindow?: string; siteAccessDetails?: string; itemAllocations: { lineItemId: string; qty: number }[];
};

const DeliveryRequestRow = ({ request, allForOrder, onAccept, onPropose, onDecline, onSetInternalNote, onSetCustomerNote, onCreateDelivery }: {
  request: AdminDeliveryRequestRow;
  allForOrder: AdminDeliveryRequestRow[];
  onAccept: (id: string) => Promise<string | null>;
  onPropose: (id: string, date: string) => Promise<string | null>;
  onDecline: (id: string, note: string) => Promise<string | null>;
  onSetInternalNote: (id: string, note: string) => Promise<string | null>;
  onSetCustomerNote: (id: string, note: string) => Promise<string | null>;
  onCreateDelivery: (orderId: string, input: SplitInput) => Promise<string | null>;
}) => {
  const [proposedDate, setProposedDate] = useState("");
  const [proposing, setProposing] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [declining, setDeclining] = useState(false);
  const [internalNote, setInternalNoteDraft] = useState(request.internal_note ?? "");
  const [customerNote, setCustomerNoteDraft] = useState(request.customer_note ?? "");
  const [splitting, setSplitting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const err = await action();
    setBusy(false);
    if (err) setError(err);
  };

  const awaitingDecision = DELIVERY_AWAITING_DECISION_STATUSES.includes(request.approval_status);

  return (
    <section className="ord-section">
      <div className="ord-section-head">
        <div>
          <h2>{request.project_name} &middot; Delivery {request.sequence_no}</h2>
          <p>
            {request.address_line1}{request.address_line2 ? `, ${request.address_line2}` : ""}, {request.suburb} {request.state} {request.postcode}
            {(request.contact_name || request.contact_phone) ? ` · ${[request.contact_name, request.contact_phone].filter(Boolean).join(" / ")}` : ""}
          </p>
        </div>
        <span className={`ord-badge ${DELIVERY_APPROVAL_ORD_TONE[request.approval_status]}`}>
          {DELIVERY_APPROVAL_STATUS_LABELS[request.approval_status]}
        </span>
      </div>

      <div className="ord-fieldgrid">
        <div className="ord-field"><label>Requested Date</label><input value={fmt(request.requested_date)} readOnly /></div>
        <div className="ord-field"><label>Proposed Date</label><input value={fmt(request.proposed_date)} readOnly /></div>
        <div className="ord-field"><label>Confirmed Date</label><input value={fmt(request.confirmed_date)} readOnly /></div>
        <div className="ord-field"><label>Actual Date</label><input value={fmt(request.actual_date)} readOnly /></div>
      </div>

      {(request.delivery_instructions || request.preferred_window || request.site_access_details) && (
        <div className="mt-2 ord-small ord-muted" style={{ display: "grid", gap: 2 }}>
          {request.delivery_instructions && <span>Instructions: {request.delivery_instructions}</span>}
          {request.preferred_window && <span>Preferred window: {request.preferred_window}</span>}
          {request.site_access_details && <span>Site access: {request.site_access_details}</span>}
        </div>
      )}

      <p className="mt-2 ord-small ord-muted">{request.item_allocations.length} item{request.item_allocations.length !== 1 ? "s" : ""} allocated to this delivery.</p>

      {error && <p className="mt-2 ord-small" style={{ color: "var(--ord-red)" }}>{error}</p>}

      {awaitingDecision && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="ord-btn primary" onClick={() => run(() => onAccept(request.id))} disabled={busy}>Accept date</button>
          {proposing ? (
            <>
              <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} style={{ height: 40, borderRadius: 10, border: "1px solid var(--ord-line2)", padding: "0 11px" }} />
              <button className="ord-btn primary" onClick={() => run(() => onPropose(request.id, proposedDate)).then(() => setProposing(false))} disabled={busy || !proposedDate}>
                Send proposed date
              </button>
              <button className="ord-btn secondary" onClick={() => setProposing(false)}>Cancel</button>
            </>
          ) : (
            <button className="ord-btn secondary" onClick={() => setProposing(true)} disabled={busy}>Propose a different date</button>
          )}
          {declining ? (
            <div className="mt-2 flex w-full flex-wrap items-center gap-2">
              <div className="ord-field" style={{ width: "100%", maxWidth: 320 }}>
                <label>Reason for the customer (optional)</label>
                <input value={declineNote} onChange={e => setDeclineNote(e.target.value)} />
              </div>
              <button className="ord-btn danger" onClick={() => run(() => onDecline(request.id, declineNote)).then(() => setDeclining(false))} disabled={busy}>
                Confirm decline
              </button>
              <button className="ord-btn secondary" onClick={() => setDeclining(false)}>Cancel</button>
            </div>
          ) : (
            <button className="ord-btn danger" onClick={() => setDeclining(true)} disabled={busy}>Decline</button>
          )}
        </div>
      )}

      <div className="ord-fieldgrid mt-3">
        <div className="ord-field full">
          <label>Internal Note (staff only)</label>
          <textarea value={internalNote} onChange={e => setInternalNoteDraft(e.target.value)} />
          <button className="ord-btn secondary mt-1" style={{ height: 32 }} onClick={() => run(() => onSetInternalNote(request.id, internalNote))} disabled={busy}>Save internal note</button>
        </div>
        <div className="ord-field full">
          <label>Customer Message</label>
          <textarea value={customerNote} onChange={e => setCustomerNoteDraft(e.target.value)} />
          <button className="ord-btn secondary mt-1" style={{ height: 32 }} onClick={() => run(() => onSetCustomerNote(request.id, customerNote))} disabled={busy}>Save customer note</button>
        </div>
        <div className="ord-field full">
          {splitting ? (
            <AdminSplitDeliveryForm
              orderId={request.order_id}
              existingAllocations={allForOrder.flatMap(r => r.item_allocations)}
              onCreate={input => onCreateDelivery(request.order_id, input)}
              onCreated={() => setSplitting(false)}
              onCancel={() => setSplitting(false)}
            />
          ) : (
            <button className="ord-btn secondary" onClick={() => setSplitting(true)}>+ Split into another delivery</button>
          )}
        </div>
      </div>
    </section>
  );
};

export const AdminDeliveryRequestsPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { requests, loading, error, reload, acceptDate, proposeDate, declineRequest, setInternalNote, setCustomerNote, createDelivery } =
    useAdminDeliveryRequests(userId, staffRole, staffRoleLoading);

  if (loading) return <LoadingState className="mt-6" label="Loading delivery requests" />;

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  return (
    <div className="ord-shell mt-2">
      <div className="ord-pagehead">
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> Internal Delivery Review</div>
          <h1>Internal Delivery Review</h1>
          <p>Review and confirm customer-requested delivery dates.</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="ord-card text-center"><EmptyState message="No delivery requests yet." /></div>
      ) : (
        <div className="ord-grid">
          {requests.map(r => (
            <DeliveryRequestRow key={r.id} request={r} allForOrder={requests.filter(x => x.order_id === r.order_id)}
              onAccept={acceptDate} onPropose={proposeDate} onDecline={declineRequest}
              onSetInternalNote={setInternalNote} onSetCustomerNote={setCustomerNote} onCreateDelivery={createDelivery}
            />
          ))}
        </div>
      )}
    </div>
  );
};
