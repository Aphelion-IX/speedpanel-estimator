// =============================================================================
// Admin -- split an order into another delivery
// =============================================================================
// Same address+contact+nested-allocation-table shape as the customer-side
// AddDeliveryForm.tsx (see that file's header comment for why this doesn't
// reduce to RepeatableRowEditor), but submits via admin_create_delivery
// (staff-only, starts the new row at approval_status='draft' -- not
// customer-visible until a staff member moves it forward, see
// supabase/schema.sql). Needs the parent order's own line_items to build the
// allocation table, which admin_list_delivery_requests() doesn't return (it's
// delivery-level, not order-level) -- fetched here on demand rather than
// batched into the main list query, since splitting is a rare action, not
// the common case every row needs to pay for.
// =============================================================================
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { cx, NAVY } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState } from "../../../ui/states";
import { Field, SelectField, TextAreaField } from "../../shared/fields";
import { OrderLineItemSchema, type OrderLineItem } from "../../../export/priceEstimateReportData";
import { LineItemAllocationTable } from "../../projects/orders/LineItemAllocationTable";
import type { OrderDeliveryItemAllocation } from "../../projects/orders/orderTypes";

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"].map(s => ({ value: s, label: s }));

export const AdminSplitDeliveryForm = ({ orderId, existingAllocations, onCreate, onCreated, onCancel }: {
  orderId: string;
  existingAllocations: OrderDeliveryItemAllocation[];
  onCreate: (input: {
    addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
    contactName?: string; contactPhone?: string; requestedDate?: string; deliveryInstructions?: string;
    preferredWindow?: string; siteAccessDetails?: string; itemAllocations: { lineItemId: string; qty: number }[];
  }) => Promise<string | null>;
  onCreated: () => void;
  onCancel: () => void;
}) => {
  const [lineItems, setLineItems] = useState<OrderLineItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoadError("Not configured for this environment."); return; }
    supabase.from("orders").select("line_items").eq("id", orderId).single().then(({ data, error }) => {
      if (error) { setLoadError(error.message); return; }
      const parsed = z.object({ line_items: z.array(OrderLineItemSchema) }).safeParse(data);
      if (!parsed.success) { setLoadError("Unexpected data shape from the server."); return; }
      setLineItems(parsed.data.line_items);
    });
  }, [orderId]);

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("NSW");
  const [postcode, setPostcode] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [preferredWindow, setPreferredWindow] = useState("");
  const [siteAccessDetails, setSiteAccessDetails] = useState("");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAllocation = (lineItemId: string, qty: number) => setAllocations(a => ({ ...a, [lineItemId]: qty }));

  if (loadError) return <ErrorState message={loadError} />;
  if (!lineItems) return <LoadingState label="Loading order items" />;

  const remaining: Record<string, number> = Object.fromEntries(lineItems.map(i => [i.id, i.qty]));
  for (const a of existingAllocations) remaining[a.lineItemId] = (remaining[a.lineItemId] ?? 0) - a.qty;

  const totalAllocated = Object.values(allocations).reduce((a, b) => a + b, 0);

  const handleSubmit = async () => {
    if (!addressLine1.trim() || !suburb.trim() || !state.trim() || !postcode.trim()) {
      setError("Address line 1, suburb, state and postcode are required.");
      return;
    }
    if (totalAllocated <= 0) { setError("Allocate at least one item to this delivery."); return; }
    setSubmitting(true);
    setError(null);
    const err = await onCreate({
      addressLine1, addressLine2: addressLine2 || undefined, suburb, state, postcode,
      requestedDate: requestedDate || undefined, contactName: contactName || undefined,
      contactPhone: contactPhone || undefined, deliveryInstructions: deliveryInstructions || undefined,
      preferredWindow: preferredWindow || undefined, siteAccessDetails: siteAccessDetails || undefined,
      itemAllocations: Object.entries(allocations).filter(([, qty]) => qty > 0).map(([lineItemId, qty]) => ({ lineItemId, qty })),
    });
    setSubmitting(false);
    if (err) { setError(err); return; }
    onCreated();
  };

  return (
    <div className={`${cx.card} mt-2`}>
      <div className="text-sm font-bold" style={{ color: NAVY }}>New delivery (split from this order)</div>
      <p className={cx.footnote}>Starts as Draft -- not visible to the customer until you accept, propose, or decline its date.</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Address line 1" value={addressLine1} onChange={setAddressLine1} required /></div>
        <div className="col-span-2"><Field label="Address line 2 (optional)" value={addressLine2} onChange={setAddressLine2} /></div>
        <Field label="Suburb" value={suburb} onChange={setSuburb} required />
        <SelectField label="State" value={state} options={AU_STATES} onChange={setState} />
        <Field label="Postcode" value={postcode} onChange={setPostcode} required />
        <Field label="Requested delivery date (optional)" type="date" value={requestedDate} onChange={setRequestedDate} />
        <Field label="Preferred delivery window (optional)" value={preferredWindow} onChange={setPreferredWindow} />
        <Field label="Site contact name (optional)" value={contactName} onChange={setContactName} />
        <Field label="Site contact mobile (optional)" value={contactPhone} onChange={setContactPhone} />
      </div>
      <div className="mt-3">
        <TextAreaField label="Delivery instructions (optional)" value={deliveryInstructions} onChange={setDeliveryInstructions} />
      </div>
      <div className="mt-3">
        <TextAreaField label="Site access details (optional)" value={siteAccessDetails} onChange={setSiteAccessDetails} />
      </div>

      <div className={cx.cardHd + " mt-4"}>Allocate items to this delivery</div>
      <LineItemAllocationTable items={lineItems} remaining={remaining} allocations={allocations} onChange={setAllocation} />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "Creating..." : "Create delivery"}</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};
