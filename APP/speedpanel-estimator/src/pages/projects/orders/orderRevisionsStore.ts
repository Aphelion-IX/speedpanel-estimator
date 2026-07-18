// =============================================================================
// Order revision history
// =============================================================================
// Feeds OrderDetailPage.tsx's "Revision History" card -- a real feed from
// order_revisions (see supabase/schema.sql's "Quote revisions" section),
// already RLS-readable by the order's owner/company/admins via
// can_view_project(). Plain select, same "already scoped to one order_id,
// no join needed" posture as projectActivityStore.ts's useProjectActivity,
// which this is directly modeled on. No RPC needed for reads -- rows are
// only ever written by revise_order(), a security definer function.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";

const NOT_CONFIGURED = "Revision history isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

const OrderRevisionRowSchema = z.object({
  id: z.string(),
  actor_kind: z.enum(["customer", "staff"]),
  old_total_inc_gst: z.number(),
  new_total_inc_gst: z.number(),
  note: z.string(),
  created_at: z.string(),
});
type OrderRevisionRow = z.infer<typeof OrderRevisionRowSchema>;

interface OrderRevisionsState {
  revisions: OrderRevisionRow[];
  loading: boolean;
  error: string | null;
}

export function useOrderRevisions(orderId: string) {
  const [state, setState] = useState<OrderRevisionsState>(() =>
    supabase ? { revisions: [], loading: true, error: null } : { revisions: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("order_revisions")
      .select("id, actor_kind, old_total_inc_gst, new_total_inc_gst, note, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (error) { setState({ revisions: [], loading: false, error: error.message }); return; }
    const parsed = OrderRevisionRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ revisions: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ revisions: parsed.data, loading: false, error: null });
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
