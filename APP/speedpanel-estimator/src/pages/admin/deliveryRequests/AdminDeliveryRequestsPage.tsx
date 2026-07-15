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
import { cx, NAVY, MUTED, BLUE } from "../../../styleTokens";
import { Field, TextAreaField } from "../../shared/fields";
import { AccordionCard } from "../../../ui/primitives";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../../ui/states";
import {
  useAdminDeliveryRequests, type AdminDeliveryRequestRow,
} from "./adminDeliveryRequestsStore";
import { DELIVERY_APPROVAL_STATUS_LABELS, DELIVERY_APPROVAL_STATUS_BADGE_CLASS, DELIVERY_AWAITING_DECISION_STATUSES } from "../../projects/orders/orderTypes";
import { AdminSplitDeliveryForm } from "./AdminSplitDeliveryForm";
import type { InternalRole } from "../../company/staffTypes";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "--");

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
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold" style={{ color: NAVY }}>{request.project_name} -- Delivery {request.sequence_no}</div>
            <span className={`${cx.badge} ${DELIVERY_APPROVAL_STATUS_BADGE_CLASS[request.approval_status]}`}>
              {DELIVERY_APPROVAL_STATUS_LABELS[request.approval_status]}
            </span>
          </div>
          <p className={cx.footnote}>
            {request.address_line1}{request.address_line2 ? `, ${request.address_line2}` : ""}, {request.suburb} {request.state} {request.postcode}
          </p>
          {(request.contact_name || request.contact_phone) && (
            <p className={cx.footnote}>{[request.contact_name, request.contact_phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><span className={cx.footnote}>Requested date</span><div style={{ color: NAVY }}>{fmt(request.requested_date)}</div></div>
        <div><span className={cx.footnote}>Proposed date</span><div style={{ color: NAVY }}>{fmt(request.proposed_date)}</div></div>
        <div><span className={cx.footnote}>Confirmed delivery date</span><div style={{ color: NAVY }}>{fmt(request.confirmed_date)}</div></div>
        <div><span className={cx.footnote}>Actual delivery date</span><div style={{ color: NAVY }}>{fmt(request.actual_date)}</div></div>
      </div>

      {(request.delivery_instructions || request.preferred_window || request.site_access_details) && (
        <div className="mt-2 space-y-0.5 text-sm" style={{ color: MUTED }}>
          {request.delivery_instructions && <p>Instructions: {request.delivery_instructions}</p>}
          {request.preferred_window && <p>Preferred window: {request.preferred_window}</p>}
          {request.site_access_details && <p>Site access: {request.site_access_details}</p>}
        </div>
      )}

      <p className={`${cx.footnote} mt-2`}>{request.item_allocations.length} item{request.item_allocations.length !== 1 ? "s" : ""} allocated to this delivery.</p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {awaitingDecision && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => run(() => onAccept(request.id))} disabled={busy}>Accept date</Button>
          {proposing ? (
            <>
              <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} className={cx.input + " w-auto !py-1.5"} style={{ color: NAVY }} />
              <Button onClick={() => run(() => onPropose(request.id, proposedDate)).then(() => setProposing(false))} disabled={busy || !proposedDate}>
                Send proposed date
              </Button>
              <Button variant="ghost" onClick={() => setProposing(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setProposing(true)} disabled={busy}>Propose a different date</Button>
          )}
          {declining ? (
            <div className="mt-2 flex w-full flex-wrap items-center gap-2">
              <div className="w-full max-w-sm"><Field label="Reason for the customer (optional)" value={declineNote} onChange={setDeclineNote} /></div>
              <Button variant="danger" onClick={() => run(() => onDecline(request.id, declineNote)).then(() => setDeclining(false))} disabled={busy}>
                Confirm decline
              </Button>
              <Button variant="ghost" onClick={() => setDeclining(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setDeclining(true)} disabled={busy}>Decline</Button>
          )}
        </div>
      )}

      <div className="mt-3">
        <AccordionCard summary={<span style={{ color: BLUE }}>Notes & split</span>}>
          <div className="space-y-3">
            <div>
              <TextAreaField label="Internal note (staff only)" value={internalNote} onChange={setInternalNoteDraft} />
              <Button variant="ghost" className="mt-1" onClick={() => run(() => onSetInternalNote(request.id, internalNote))} disabled={busy}>Save internal note</Button>
            </div>
            <div>
              <TextAreaField label="Customer-facing note" value={customerNote} onChange={setCustomerNoteDraft} />
              <Button variant="ghost" className="mt-1" onClick={() => run(() => onSetCustomerNote(request.id, customerNote))} disabled={busy}>Save customer note</Button>
            </div>
            <div>
              {splitting ? (
                <AdminSplitDeliveryForm
                  orderId={request.order_id}
                  existingAllocations={allForOrder.flatMap(r => r.item_allocations)}
                  onCreate={input => onCreateDelivery(request.order_id, input)}
                  onCreated={() => setSplitting(false)}
                  onCancel={() => setSplitting(false)}
                />
              ) : (
                <Button variant="ghost" onClick={() => setSplitting(true)}>+ Split into another delivery</Button>
              )}
            </div>
          </div>
        </AccordionCard>
      </div>
    </div>
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

  if (requests.length === 0) {
    return <EmptyState className={`${cx.card} mt-6 text-center`} message="No delivery requests yet." />;
  }

  return (
    <div className="mt-2">
      {requests.map(r => (
        <DeliveryRequestRow key={r.id} request={r} allForOrder={requests.filter(x => x.order_id === r.order_id)}
          onAccept={acceptDate} onPropose={proposeDate} onDecline={declineRequest}
          onSetInternalNote={setInternalNote} onSetCustomerNote={setCustomerNote} onCreateDelivery={createDelivery}
        />
      ))}
    </div>
  );
};
