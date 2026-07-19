
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { supabase } from "../../../lib/supabaseClient";
import { useAsyncResource } from "../../projects/useAsyncResource";
import { OrderOperationsRowSchema } from "../../projects/orders/orderOperationsTypes";
import { useMyQueueScope, applyQueueScope } from "../shared/useMyQueueScope";
import type { InternalRole } from "../../company/staffTypes";

const NOT_CONFIGURED =
  "Order operations aren't configured for this environment.";
const BAD_SHAPE = "Unexpected order operations data from the server.";

const AdminOrderOperationsRowSchema =
  OrderOperationsRowSchema.extend({
    orders: z.object({
      id: z.string(),
      order_number: z.string().nullable(),
      project_id: z.string(),
      stage: z.string(),
      total_inc_gst: z.number(),
      unpriced_item_count: z.number(),
      created_at: z.string(),
      company_id: z.string().nullable(),
      projects: z.object({
        id: z.string(),
        name: z.string(),
        project_number: z.string().nullable(),
        company_id: z.string().nullable(),
      }).nullable(),
    }),
  });

export type AdminOrderOperationsRow =
  z.infer<typeof AdminOrderOperationsRowSchema>;

export function useAdminOrderOperations(
  userId: string | null,
  staffRole: InternalRole | null,
  staffRoleLoading: boolean,
) {
  const {
    scope,
    loading: scopeLoading,
    error: scopeError,
  } = useMyQueueScope(userId, staffRole, staffRoleLoading);

  const fetchRows = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };
    if (scopeLoading) return { data: [], error: null };
    if (scopeError) return { data: [], error: scopeError };

    const base = supabase
      .from("order_operations")
      .select(`
        *,
        orders!inner(
          id,
          order_number,
          project_id,
          stage,
          total_inc_gst,
          unpriced_item_count,
          created_at,
          company_id,
          projects(
            id,
            name,
            project_number,
            company_id
          )
        )
      `)
      .in("operational_status", [
        "under_review",
        "changes_required",
        "quote_issued",
        "accepted",
        "processing",
        "manufacturing",
        "ready_for_delivery",
        "partially_delivered",
      ]);

    const query = applyQueueScope(
      base,
      scope,
      "company_id",
    );

    const { data, error } = await query.order(
      "updated_at",
      { ascending: true },
    );

    if (error) return { data: [], error: error.message };

    const parsed =
      AdminOrderOperationsRowSchema.array().safeParse(
        data ?? [],
      );

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [
    scopeLoading,
    scopeError,
    scope.kind === "companies"
      ? scope.companyIds.join(",")
      : "all",
  ]);

  const state = useAsyncResource(fetchRows, [
    scopeLoading,
    scopeError,
    scope.kind === "companies"
      ? scope.companyIds.join(",")
      : "all",
  ], {
    initialData: [] as AdminOrderOperationsRow[],
    skip: !supabase || scopeLoading,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const counts = useMemo(() => ({
    total: state.data.length,
    actionRequired: state.data.filter(
      row => row.customer_action_required,
    ).length,
    review: state.data.filter(row =>
      ["under_review", "changes_required"].includes(
        row.operational_status,
      ),
    ).length,
    manufacturing: state.data.filter(
      row => row.operational_status === "manufacturing",
    ).length,
  }), [state.data]);

  return {
    orders: state.data,
    counts,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}
