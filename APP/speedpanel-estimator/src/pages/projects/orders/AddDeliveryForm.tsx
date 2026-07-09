// =============================================================================
// Add-delivery form -- address + per-line-item allocation for a new batch
// =============================================================================
// A delivery batch is fundamentally an address form (Field/SelectField from
// src/pages/shared/fields.tsx) plus a nested fixed-row allocation table --
// doesn't reduce to RepeatableRowEditor's flat-row-of-scalar-cells model.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE } from "../../../styleTokens";
import { Field, SelectField, TextAreaField } from "../../shared/fields";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import { LineItemAllocationTable } from "./LineItemAllocationTable";
import type { DeliveryInput } from "./orderDeliveriesStore";

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map(s => ({ value: s, label: s }));

export const AddDeliveryForm = ({ lineItems, remaining, onAdd, onCancel }: {
  lineItems: OrderLineItem[]; remaining: Record<string, number>;
  onAdd: (input: DeliveryInput) => Promise<string | null>; onCancel: () => void;
}) => {
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("NSW");
  const [postcode, setPostcode] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAllocation = (lineItemId: string, qty: number) => setAllocations(a => ({ ...a, [lineItemId]: qty }));

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);

  const handleSubmit = async () => {
    if (!addressLine1.trim() || !suburb.trim() || !state.trim() || !postcode.trim()) {
      setError("Address line 1, suburb, state and postcode are required.");
      return;
    }
    if (totalAllocated <= 0) { setError("Allocate at least one item to this delivery."); return; }
    setSubmitting(true);
    setError(null);
    const err = await onAdd({
      addressLine1, addressLine2: addressLine2 || undefined, suburb, state, postcode,
      requestedDate: requestedDate || undefined, contactName: contactName || undefined,
      contactPhone: contactPhone || undefined, notes: notes || undefined,
      itemAllocations: Object.entries(allocations).filter(([, qty]) => qty > 0).map(([lineItemId, qty]) => ({ lineItemId, qty })),
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="text-sm font-bold" style={{ color: NAVY }}>New delivery</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Address line 1" value={addressLine1} onChange={setAddressLine1} required /></div>
        <div className="col-span-2"><Field label="Address line 2 (optional)" value={addressLine2} onChange={setAddressLine2} /></div>
        <Field label="Suburb" value={suburb} onChange={setSuburb} required />
        <SelectField label="State" value={state} options={AU_STATES} onChange={setState} />
        <Field label="Postcode" value={postcode} onChange={setPostcode} required />
        <Field label="Requested date (optional)" type="date" value={requestedDate} onChange={setRequestedDate} />
        <Field label="Site contact name (optional)" value={contactName} onChange={setContactName} />
        <Field label="Site contact phone (optional)" value={contactPhone} onChange={setContactPhone} />
      </div>
      <div className="mt-3">
        <TextAreaField label="Delivery notes (optional)" value={notes} onChange={setNotes} />
      </div>

      <div className={cx.cardHd + " mt-4"}>Allocate items to this delivery</div>
      <LineItemAllocationTable items={lineItems} remaining={remaining} allocations={allocations} onChange={setAllocation} />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={handleSubmit} disabled={submitting}
          className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {submitting ? "Adding..." : "Add delivery"}
        </button>
        <button onClick={onCancel} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
          Cancel
        </button>
      </div>
    </div>
  );
};
