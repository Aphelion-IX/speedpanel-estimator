// =============================================================================
// Order Deliveries -- live Supabase fetch/CRUD for one order's delivery requests
// =============================================================================
// RLS (see supabase/schema.sql's "Delivery request/approval workflow"
// section) allows a customer to create a delivery REQUEST once the parent
// order has left 'draft' (submitted/proforma_requested/proforma_issued), edit
// or withdraw it while still 'pending'/'date_proposed', and request a date
// change on an already-'accepted' row only via the dedicated
// request_delivery_date_change RPC -- this store makes no attempt to
// pre-check any of that client-side; a customer trying an operation outside
// what RLS/the RPCs allow simply gets an error back from Supabase, same
// "server is the real gate" posture as every other RLS-backed mutation in
// this app.
//
// Explicit column list on load() (not `select("*")`) deliberately excludes
// internal_note -- that column's SELECT grant is revoked from `authenticated`
// at the DB level, so a `select("*")` here would error entirely (PostgREST
// rejects the whole request if the caller lacks privilege on any requested
// column). Staff read internal_note through admin_list_delivery_requests()
// instead (see adminDeliveryRequestsStore.ts).
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderDeliveryRowSchema, type OrderDeliveryRow, type OrderDeliveryItemAllocation } from "./orderTypes";

const NOT_CONFIGURED = "Deliveries aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const DELIVERY_COLUMNS = [
  "id", "order_id", "sequence_no", "address_line1", "address_line2", "suburb", "state", "postcode",
  "requested_date", "proposed_date", "confirmed_date", "actual_date", "contact_name", "contact_phone",
  "delivery_instructions", "preferred_window", "site_access_details", "customer_note", "item_allocations",
  "status", "approval_status", "created_at", "updated_at",
].join(", ");

interface DeliveriesState { deliveries: OrderDeliveryRow[]; loading: boolean; error: string | null; }

export interface DeliveryInput {
  addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
  requestedDate?: string; contactName?: string; contactPhone?: string; deliveryInstructions?: string;
  preferredWindow?: string; siteAccessDetails?: string;
  itemAllocations: OrderDeliveryItemAllocation[];
}

function toRow(input: DeliveryInput) {
  return {
    address_line1: input.addressLine1, address_line2: input.addressLine2 || null,
    suburb: input.suburb, state: input.state, postcode: input.postcode,
    requested_date: input.requestedDate || null, contact_name: input.contactName || null,
    contact_phone: input.contactPhone || null, delivery_instructions: input.deliveryInstructions || null,
    preferred_window: input.preferredWindow || null, site_access_details: input.siteAccessDetails || null,
    item_allocations: input.itemAllocations,
    // Every customer-created request lands as 'pending' -- WITH CHECK on the
    // insert RLS policy requires exactly this, matching the confirmed
    // "customers always submit directly" decision (no client-side draft
    // state; see systemSelector's own SaveDraftBanner for contrast, which
    // is an unrelated draft-project concept, not this one).
    approval_status: "pending" as const,
  };
}

export function useOrderDeliveries(orderId: string) {
  const [state, setState] = useState<DeliveriesState>(() =>
    supabase
      ? { deliveries: [], loading: true, error: null }
      : { deliveries: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("order_deliveries").select(DELIVERY_COLUMNS)
      .eq("order_id", orderId).order("sequence_no", { ascending: true });
    if (error) { setState({ deliveries: [], loading: false, error: error.message }); return; }
    const parsed = OrderDeliveryRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ deliveries: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ deliveries: parsed.data, loading: false, error: null });
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const addDelivery = async (input: DeliveryInput): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("order_deliveries").insert({
      order_id: orderId, sequence_no: state.deliveries.length + 1, ...toRow(input),
    });
    if (error) return error.message;
    await load();
    return null;
  };

  const removeDelivery = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.from("order_deliveries").delete().eq("id", id);
    if (error) return error.message;
    await load();
    return null;
  };

  // The only write path once a request is 'accepted' -- reopens it as
  // 'pending' for staff to review again (see request_delivery_date_change).
  const requestDateChange = async (id: string, newRequestedDate: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("request_delivery_date_change", {
      p_delivery_id: id, p_new_requested_date: newRequestedDate,
    });
    if (error) return error.message;
    await load();
    return null;
  };

  // Accepts a staff-proposed alternative date (approval_status='date_proposed').
  const acceptProposedDate = async (id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("accept_proposed_delivery_date", { p_delivery_id: id });
    if (error) return error.message;
    await load();
    return null;
  };

  return { ...state, reload: load, addDelivery, removeDelivery, requestDateChange, acceptProposedDate };
}
