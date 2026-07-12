// =============================================================================
// One delivery request -- customer-facing, approval-status-driven
// =============================================================================
// The customer-side counterpart to DeliveryBatchCard.tsx (which stays as-is
// for the admin Manufacturing page, driven by the separate fulfillment
// `status`, not `approval_status`). Copy and actions are entirely driven by
// approval_status -- see DELIVERY_APPROVAL_STATUSES in orderTypes.ts:
//   pending       -- awaiting Speedpanel's decision, editable/withdrawable
//   date_proposed -- Speedpanel offered an alternative date
//   accepted      -- confirmed; the date is locked, only "Request date
//                    change" (not a raw editable field) can move it
//   declined      -- read-only; customer's only recourse is a new request
// =============================================================================
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../../styleTokens";
import { AccordionCard } from "../../../ui/primitives";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import { DELIVERY_APPROVAL_STATUS_LABELS, DELIVERY_APPROVAL_STATUS_BADGE_CLASS, type OrderDeliveryRow } from "./orderTypes";
import { LineItemAllocationTable } from "./LineItemAllocationTable";

const fmt = (iso: string) => new Date(iso).toLocaleDateString();

export const DeliveryRequestCard = ({ delivery, lineItems, onRemove, onAcceptProposedDate, onRequestDateChange }: {
  delivery: OrderDeliveryRow; lineItems: OrderLineItem[];
  onRemove: (id: string) => void;
  onAcceptProposedDate: (id: string) => void;
  onRequestDateChange: (id: string, newDate: string) => void;
}) => {
  const [changingDate, setChangingDate] = useState(false);
  const [newDate, setNewDate] = useState("");
  const allocations = Object.fromEntries(delivery.item_allocations.map(a => [a.lineItemId, a.qty]));

  const submitDateChange = () => {
    if (!newDate) return;
    onRequestDateChange(delivery.id, newDate);
    setChangingDate(false);
    setNewDate("");
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold" style={{ color: NAVY }}>Delivery {delivery.sequence_no}</div>
          <span className={`${cx.badge} ${DELIVERY_APPROVAL_STATUS_BADGE_CLASS[delivery.approval_status]}`}>
            {DELIVERY_APPROVAL_STATUS_LABELS[delivery.approval_status]}
          </span>
        </div>
        {delivery.approval_status === "pending" && (
          <button onClick={() => onRemove(delivery.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <p className={cx.footnote}>
        {delivery.address_line1}{delivery.address_line2 ? `, ${delivery.address_line2}` : ""}, {delivery.suburb} {delivery.state} {delivery.postcode}
      </p>
      {(delivery.contact_name || delivery.contact_phone) && (
        <p className={cx.footnote}>{[delivery.contact_name, delivery.contact_phone].filter(Boolean).join(" · ")}</p>
      )}

      {delivery.approval_status === "pending" && (
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          Pending approval{delivery.requested_date ? ` — Requested for ${fmt(delivery.requested_date)}` : ""}. Speedpanel will confirm the delivery date.
        </p>
      )}

      {delivery.approval_status === "date_proposed" && (
        <div className="mt-2">
          <p className="text-sm" style={{ color: MUTED }}>
            Speedpanel proposed a different date{delivery.proposed_date ? `: ${fmt(delivery.proposed_date)}` : ""}.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={() => onAcceptProposedDate(delivery.id)}
              className="rounded-xl px-3 py-1.5 text-xs font-bold" style={{ background: BLUE, color: WHITE }}>
              Accept proposed date
            </button>
            {changingDate ? (
              <>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={cx.input + " w-auto !py-1.5"} style={{ color: NAVY }} />
                <button onClick={submitDateChange} disabled={!newDate} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ color: NAVY }}>Request this date</button>
                <button onClick={() => setChangingDate(false)} className="text-xs font-semibold" style={{ color: MUTED }}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setChangingDate(true)} className="text-xs font-bold" style={{ color: BLUE }}>Propose a different date</button>
            )}
          </div>
        </div>
      )}

      {delivery.approval_status === "accepted" && (
        <div className="mt-2">
          <p className="text-sm font-semibold" style={{ color: NAVY }}>
            {delivery.confirmed_date ? `Confirmed delivery date: ${fmt(delivery.confirmed_date)}` : "Confirmed"}
          </p>
          {changingDate ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={cx.input + " w-auto !py-1.5"} style={{ color: NAVY }} />
              <button onClick={submitDateChange} disabled={!newDate} className="rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>Submit</button>
              <button onClick={() => setChangingDate(false)} className="text-xs font-semibold" style={{ color: MUTED }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setChangingDate(true)} className="mt-1 text-xs font-bold" style={{ color: BLUE }}>Request date change</button>
          )}
        </div>
      )}

      {delivery.approval_status === "declined" && delivery.customer_note && (
        <p className="mt-2 text-sm" style={{ color: MUTED }}>{delivery.customer_note}</p>
      )}

      {delivery.delivery_instructions && <p className="mt-2 text-sm" style={{ color: MUTED }}>{delivery.delivery_instructions}</p>}

      <div className="mt-3">
        <AccordionCard summary={<span style={{ color: BLUE }}>Items in this delivery ({delivery.item_allocations.length})</span>}>
          <LineItemAllocationTable items={lineItems} remaining={{}} allocations={allocations} readOnly />
        </AccordionCard>
      </div>
    </div>
  );
};
