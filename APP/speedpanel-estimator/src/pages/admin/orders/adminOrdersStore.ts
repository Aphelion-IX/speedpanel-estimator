// =============================================================================
// Admin order review queue -- live Supabase fetch
// =============================================================================
// Same shape as adminProjectsStore.ts's useAdminProjects: a narrow "awaiting
// action" queue (stage = 'proforma_requested', not every order), and a
// successful action removes the row locally since it leaves that filter --
// same "narrower than submitted, matches the two-step decision" reasoning
// documented in supabase/schema.sql.
//
// Scoped to the caller's assigned companies via useMyQueueScope/
// applyQueueScope (see shared/useMyQueueScope.ts) -- a super_admin (or any
// account with no staff_role) still sees every order, unfiltered.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { OrderRowSchema, type OrderRow } from "../../projects/orders/orderTypes";
import { useMyQueueScope, applyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

const NOT_CONFIGURED = "Orders aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

interface AdminOrdersState { orders: OrderRow[]; loading: boolean; error: string | null; }

export function useAdminOrders(userId: string | null, staffRole: InternalRole | null, staffRoleLoading: boolean) {
  const { scope, loading: scopeLoading, error: scopeError } = useMyQueueScope(userId, staffRole, staffRoleLoading);
  const [state, setState] = useState<AdminOrdersState>(() =>
    supabase
      ? { orders: [], loading: true, error: null }
      : { orders: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase || scopeLoading) return;
    if (scopeError) { setState({ orders: [], loading: false, error: scopeError }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await applyQueueScope(
      supabase.from("orders").select("*").eq("stage", "proforma_requested"), scope,
    ).order("proforma_requested_at", { ascending: true });
    if (error) { setState({ orders: [], loading: false, error: error.message }); return; }
    const parsed = OrderRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ orders: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ orders: parsed.data, loading: false, error: null });
  }, [scopeLoading, scopeError, scope.kind === "companies" ? scope.companyIds.join(",") : "all"]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (fn: string, args: Record<string, unknown>, id: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    setState(s => ({ ...s, orders: s.orders.filter(o => o.id !== id) }));
    return null;
  };

  const issueProforma = (id: string, note: string) =>
    runAction("issue_proforma_invoice", { p_order_id: id, p_note: note || null }, id);
  const cancelOrder = (id: string) => runAction("cancel_order", { p_order_id: id }, id);

  return { ...state, reload: load, issueProforma, cancelOrder };
}
