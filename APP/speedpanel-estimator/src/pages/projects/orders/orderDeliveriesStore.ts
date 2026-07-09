// =============================================================================
// Order Deliveries -- live Supabase fetch/CRUD for one order's delivery batches
// =============================================================================
// RLS (see supabase/schema.sql) only allows insert/update/delete while the
// parent order is still 'draft' (or by an admin anytime) -- this store makes
// no attempt to pre-check that client-side; a customer trying to edit
// deliveries on an already-submitted order simply gets an error back from
// Supabase, same "server is the real gate" posture as every other RLS-backed
// mutation in this app.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderDeliveryRowSchema, type OrderDeliveryRow, type OrderDeliveryItemAllocation } from "./orderTypes";

const NOT_CONFIGURED = "Deliveries aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface DeliveriesState { deliveries: OrderDeliveryRow[]; loading: boolean; error: string | null; }

export interface DeliveryInput {
  addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
  requestedDate?: string; contactName?: string; contactPhone?: string; notes?: string;
  itemAllocations: OrderDeliveryItemAllocation[];
}

function toRow(input: DeliveryInput) {
  return {
    address_line1: input.addressLine1, address_line2: input.addressLine2 || null,
    suburb: input.suburb, state: input.state, postcode: input.postcode,
    requested_date: input.requestedDate || null, contact_name: input.contactName || null,
    contact_phone: input.contactPhone || null, notes: input.notes || null,
    item_allocations: input.itemAllocations,
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
    const { data, error } = await supabase.from("order_deliveries").select("*")
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

  return { ...state, reload: load, addDelivery, removeDelivery };
}
