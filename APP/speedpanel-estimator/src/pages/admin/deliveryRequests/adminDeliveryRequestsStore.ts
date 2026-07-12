// =============================================================================
// Admin delivery requests -- live Supabase fetch/actions
// =============================================================================
// Backed by admin_list_delivery_requests() (see supabase/schema.sql), a
// security-definer table function rather than a plain table select -- it's
// the only read path that includes internal_note, which is column-privilege-
// revoked from `authenticated` at the DB level (see orderDeliveriesStore.ts's
// header comment). Returns every delivery request across every order
// (including approval_status='draft' staff-split scratch rows, unlike the
// customer-facing read path, which filters those out client-side instead).
//
// Scoped to the caller's assigned companies via useMyQueueScope/
// applyQueueScope (see shared/useMyQueueScope.ts) -- a super_admin (or any
// account with no staff_role) sees every request, unfiltered. Both
// internal_sales and dispatch reach this page (see adminSectionAccess.ts),
// same "Internal Sales or Dispatch" gate the underlying RPCs themselves
// enforce.
//
// Every action reloads the full list on success rather than optimistically
// patching local state -- several fields can change per action (e.g.
// accepting sets both approval_status and confirmed_date), and this store
// has more distinct mutations than any other admin store in this app;
// reload-after-mutation (same posture as orderDeliveriesStore.ts's
// customer-side actions) is simpler and less error-prone than hand-
// reconstructing each partial update.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { OrderDeliveryItemAllocationSchema, DELIVERY_STATUSES, DELIVERY_APPROVAL_STATUSES } from "../../projects/orders/orderTypes";
import { useMyQueueScope, applyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

const NOT_CONFIGURED = "Delivery requests aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const AdminDeliveryRequestRowSchema = z.object({
  id: z.string(), order_id: z.string(), sequence_no: z.number(),
  address_line1: z.string(), address_line2: z.string().nullable(), suburb: z.string(), state: z.string(), postcode: z.string(),
  contact_name: z.string().nullable(), contact_phone: z.string().nullable(),
  delivery_instructions: z.string().nullable(), preferred_window: z.string().nullable(), site_access_details: z.string().nullable(),
  requested_date: z.string().nullable(), proposed_date: z.string().nullable(), confirmed_date: z.string().nullable(), actual_date: z.string().nullable(),
  approval_status: z.enum(DELIVERY_APPROVAL_STATUSES), internal_note: z.string().nullable(), customer_note: z.string().nullable(),
  item_allocations: z.array(OrderDeliveryItemAllocationSchema), status: z.enum(DELIVERY_STATUSES),
  company_id: z.string().nullable(), order_stage: z.string(), project_name: z.string(),
  created_at: z.string(), updated_at: z.string(),
});
export type AdminDeliveryRequestRow = z.infer<typeof AdminDeliveryRequestRowSchema>;

interface AdminDeliveryRequestsState { requests: AdminDeliveryRequestRow[]; loading: boolean; error: string | null; }

export function useAdminDeliveryRequests(userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean) {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [state, setState] = useState<AdminDeliveryRequestsState>(() =>
    supabase
      ? { requests: [], loading: true, error: null }
      : { requests: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ requests: [], loading: false, error: scopeError }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await applyQueueScope(supabase.rpc("admin_list_delivery_requests"), scope);
    if (error) { setState({ requests: [], loading: false, error: error.message }); return; }
    const parsed = AdminDeliveryRequestRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ requests: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ requests: parsed.data, loading: false, error: null });
  }, [scopeLoading, scopeError, scope.kind === "companies" ? scope.companyIds.join(",") : "all"]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await load();
    return null;
  };

  const acceptDate = (id: string) => runAction("accept_delivery_date", { p_delivery_id: id });
  const proposeDate = (id: string, date: string) => runAction("propose_delivery_date", { p_delivery_id: id, p_proposed_date: date });
  const declineRequest = (id: string, customerNote: string) =>
    runAction("decline_delivery_request", { p_delivery_id: id, p_customer_note: customerNote || null });
  const setInternalNote = (id: string, note: string) => runAction("set_delivery_internal_note", { p_delivery_id: id, p_note: note || null });
  const setCustomerNote = (id: string, note: string) => runAction("set_delivery_customer_note", { p_delivery_id: id, p_note: note || null });

  const createDelivery = (orderId: string, input: {
    addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
    contactName?: string; contactPhone?: string; requestedDate?: string; deliveryInstructions?: string;
    preferredWindow?: string; siteAccessDetails?: string; itemAllocations: { lineItemId: string; qty: number }[];
  }) => runAction("admin_create_delivery", {
    p_order_id: orderId, p_address_line1: input.addressLine1, p_address_line2: input.addressLine2 || null,
    p_suburb: input.suburb, p_state: input.state, p_postcode: input.postcode,
    p_contact_name: input.contactName || null, p_contact_phone: input.contactPhone || null,
    p_requested_date: input.requestedDate || null, p_delivery_instructions: input.deliveryInstructions || null,
    p_preferred_window: input.preferredWindow || null, p_site_access_details: input.siteAccessDetails || null,
    p_item_allocations: input.itemAllocations,
  });

  const updateDelivery = (id: string, input: {
    addressLine1: string; addressLine2?: string; suburb: string; state: string; postcode: string;
    contactName?: string; contactPhone?: string; deliveryInstructions?: string;
    preferredWindow?: string; siteAccessDetails?: string; itemAllocations: { lineItemId: string; qty: number }[];
  }) => runAction("admin_update_delivery", {
    p_delivery_id: id, p_address_line1: input.addressLine1, p_address_line2: input.addressLine2 || null,
    p_suburb: input.suburb, p_state: input.state, p_postcode: input.postcode,
    p_contact_name: input.contactName || null, p_contact_phone: input.contactPhone || null,
    p_delivery_instructions: input.deliveryInstructions || null, p_preferred_window: input.preferredWindow || null,
    p_site_access_details: input.siteAccessDetails || null, p_item_allocations: input.itemAllocations,
  });

  return { ...state, reload: load, acceptDate, proposeDate, declineRequest, setInternalNote, setCustomerNote, createDelivery, updateDelivery };
}
