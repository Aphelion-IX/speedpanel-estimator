
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAsyncResource } from "../useAsyncResource";
import {
  ORDER_DOCUMENTS_BUCKET,
  OrderAcceptanceSnapshotRowSchema,
  OrderAdjustmentRowSchema,
  OrderCommercialTotalsSchema,
  OrderCompletionCheckSchema,
  OrderDocumentRowSchema,
  OrderHoldRowSchema,
  OrderOperationsAuditRowSchema,
  OrderOperationsRowSchema,
  type OrderAdjustmentType,
  type OrderDocumentRow,
  type OrderDocumentType,
  type OrderDocumentVisibility,
  type OrderHoldType,
  type OrderOperationalStatus,
} from "./orderOperationsTypes";

const NOT_CONFIGURED =
  "Order operations aren't configured for this environment.";
const BAD_SHAPE =
  "Unexpected order operations data from the server.";

export function useOrderOperations(orderId: string) {
  const fetchOperations = useCallback(async () => {
    if (!supabase) return { data: null, error: NOT_CONFIGURED };

    const { data, error } = await supabase
      .from("order_operations")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };

    if (!data) {
      const { error: ensureError } = await supabase.rpc(
        "ensure_order_operations",
        { p_order_id: orderId },
      );
      if (ensureError) {
        return { data: null, error: ensureError.message };
      }

      const { data: ensured, error: readError } = await supabase
        .from("order_operations")
        .select("*")
        .eq("order_id", orderId)
        .single();

      if (readError) {
        return { data: null, error: readError.message };
      }

      const parsedEnsured =
        OrderOperationsRowSchema.safeParse(ensured);
      return parsedEnsured.success
        ? { data: parsedEnsured.data, error: null }
        : { data: null, error: BAD_SHAPE };
    }

    const parsed = OrderOperationsRowSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: null, error: BAD_SHAPE };
  }, [orderId]);

  const state = useAsyncResource(fetchOperations, [orderId], {
    initialData: null as ReturnType<
      typeof OrderOperationsRowSchema.parse
    > | null,
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const call = async (
    fn: string,
    args: Record<string, unknown>,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await state.reload();
    return null;
  };

  const progress = (
    toStatus: OrderOperationalStatus,
    expectedVersion: number,
  ) =>
    call("progress_order_operational_status", {
      p_order_id: orderId,
      p_to_status: toStatus,
      p_expected_version: expectedVersion,
    });

  const correct = (
    toStatus: OrderOperationalStatus,
    expectedVersion: number,
    reason: string,
  ) =>
    call("correct_order_operational_status", {
      p_order_id: orderId,
      p_to_status: toStatus,
      p_expected_version: expectedVersion,
      p_reason: reason,
    });

  const setCustomerAction = (
    required: boolean,
    note: string | null,
    expectedVersion: number,
  ) =>
    call("set_order_customer_action", {
      p_order_id: orderId,
      p_required: required,
      p_note: note,
      p_expected_version: expectedVersion,
    });

  const acceptQuote = (expectedVersion: number) =>
    call("accept_order_quote", {
      p_order_id: orderId,
      p_expected_version: expectedVersion,
    });

  const requestChanges = (
    note: string,
    expectedVersion: number,
  ) =>
    call("request_order_changes", {
      p_order_id: orderId,
      p_note: note,
      p_expected_version: expectedVersion,
    });

  const complete = (expectedVersion: number) =>
    call("complete_order", {
      p_order_id: orderId,
      p_expected_version: expectedVersion,
    });

  const createLinkedDraft = async (
    kind: "repeat" | "amendment",
    reason?: string,
  ): Promise<{ id: string | null; error: string | null }> => {
    if (!supabase) return { id: null, error: NOT_CONFIGURED };

    const fn =
      kind === "repeat"
        ? "repeat_order"
        : "create_order_amendment";
    const args =
      kind === "repeat"
        ? { p_source_order_id: orderId }
        : {
            p_source_order_id: orderId,
            p_reason: reason ?? null,
          };

    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { id: null, error: error.message };

    return {
      id: typeof data === "string" ? data : null,
      error: typeof data === "string" ? null : BAD_SHAPE,
    };
  };

  return {
    operations: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    progress,
    correct,
    setCustomerAction,
    acceptQuote,
    requestChanges,
    complete,
    createLinkedDraft,
  };
}

export function useOrderCommercialSummary(orderId: string) {
  const fetchSummary = useCallback(async () => {
    if (!supabase) {
      return {
        data: {
          adjustments: [],
          totals: null,
          snapshot: null,
        },
        error: NOT_CONFIGURED,
      };
    }

    const [
      adjustmentsResponse,
      totalsResponse,
      snapshotResponse,
    ] = await Promise.all([
      supabase
        .from("order_adjustments")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at"),
      supabase.rpc("order_commercial_totals", {
        p_order_id: orderId,
      }),
      supabase
        .from("order_acceptance_snapshots")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle(),
    ]);

    const firstError =
      adjustmentsResponse.error ??
      totalsResponse.error ??
      snapshotResponse.error;

    if (firstError) {
      return {
        data: {
          adjustments: [],
          totals: null,
          snapshot: null,
        },
        error: firstError.message,
      };
    }

    const adjustments =
      OrderAdjustmentRowSchema.array().safeParse(
        adjustmentsResponse.data ?? [],
      );
    const totals = OrderCommercialTotalsSchema.safeParse(
      totalsResponse.data,
    );
    const snapshot = snapshotResponse.data
      ? OrderAcceptanceSnapshotRowSchema.safeParse(
          snapshotResponse.data,
        )
      : null;

    if (
      !adjustments.success ||
      !totals.success ||
      (snapshot && !snapshot.success)
    ) {
      return {
        data: {
          adjustments: [],
          totals: null,
          snapshot: null,
        },
        error: BAD_SHAPE,
      };
    }

    return {
      data: {
        adjustments: adjustments.data,
        totals: totals.data,
        snapshot: snapshot?.data ?? null,
      },
      error: null,
    };
  }, [orderId]);

  const state = useAsyncResource(fetchSummary, [orderId], {
    initialData: {
      adjustments: [] as ReturnType<
        typeof OrderAdjustmentRowSchema.parse
      >[],
      totals: null as ReturnType<
        typeof OrderCommercialTotalsSchema.parse
      > | null,
      snapshot: null as ReturnType<
        typeof OrderAcceptanceSnapshotRowSchema.parse
      > | null,
    },
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const addAdjustment = async (input: {
    adjustmentType: OrderAdjustmentType;
    label: string;
    amountExGst: number;
    taxable: boolean;
  }): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase.rpc(
      "add_order_adjustment",
      {
        p_order_id: orderId,
        p_adjustment_type: input.adjustmentType,
        p_label: input.label,
        p_amount_ex_gst: input.amountExGst,
        p_taxable: input.taxable,
      },
    );

    if (error) return error.message;
    await state.reload();
    return null;
  };

  const removeAdjustment = async (
    adjustmentId: string,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase.rpc(
      "remove_order_adjustment",
      { p_adjustment_id: adjustmentId },
    );

    if (error) return error.message;
    await state.reload();
    return null;
  };

  return {
    ...state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    addAdjustment,
    removeAdjustment,
  };
}

export function useOrderHolds(orderId: string) {
  const fetchHolds = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };

    const { data, error } = await supabase.rpc(
      "list_order_holds",
      { p_order_id: orderId },
    );

    if (error) return { data: [], error: error.message };

    const parsed = OrderHoldRowSchema.array().safeParse(
      data ?? [],
    );

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [orderId]);

  const state = useAsyncResource(fetchHolds, [orderId], {
    initialData: [] as ReturnType<
      typeof OrderHoldRowSchema.parse
    >[],
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const placeHold = async (input: {
    holdType: OrderHoldType;
    title: string;
    reason: string;
    customerVisible: boolean;
    customerMessage?: string | null;
  }): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase.rpc(
      "place_order_hold",
      {
        p_order_id: orderId,
        p_hold_type: input.holdType,
        p_title: input.title,
        p_reason: input.reason,
        p_customer_visible: input.customerVisible,
        p_customer_message: input.customerMessage ?? null,
      },
    );

    if (error) return error.message;
    await state.reload();
    return null;
  };

  const resolveHold = async (
    holdId: string,
    note?: string,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase.rpc(
      "resolve_order_hold",
      {
        p_hold_id: holdId,
        p_note: note ?? null,
      },
    );

    if (error) return error.message;
    await state.reload();
    return null;
  };

  return {
    holds: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    placeHold,
    resolveHold,
  };
}

export function useOrderDocuments(
  orderId: string,
  userId: string | null,
) {
  const fetchDocuments = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };

    const { data, error } = await supabase
      .from("order_documents")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    const parsed = OrderDocumentRowSchema.array().safeParse(
      data ?? [],
    );

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [orderId]);

  const state = useAsyncResource(fetchDocuments, [orderId], {
    initialData: [] as OrderDocumentRow[],
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const uploadDocument = async (
    file: File,
    documentType: OrderDocumentType,
    visibility: OrderDocumentVisibility,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    if (!userId) return "Not signed in.";

    const path =
      `${orderId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(ORDER_DOCUMENTS_BUCKET)
      .upload(path, file);

    if (uploadError) return uploadError.message;

    const existingVersions = state.data
      .filter(
        document =>
          document.document_type === documentType &&
          document.file_name === file.name,
      )
      .map(document => document.version);

    const version =
      existingVersions.length > 0
        ? Math.max(...existingVersions) + 1
        : 1;

    const { data, error } = await supabase
      .from("order_documents")
      .insert({
        order_id: orderId,
        document_type: documentType,
        visibility,
        uploaded_by: userId,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type || null,
        version,
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage
        .from(ORDER_DOCUMENTS_BUCKET)
        .remove([path]);
      return error.message;
    }

    const parsed = OrderDocumentRowSchema.safeParse(data);
    if (!parsed.success) return BAD_SHAPE;

    state.setData(previous => [
      parsed.data,
      ...previous,
    ]);
    return null;
  };

  const removeDocument = async (
    document: OrderDocumentRow,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;

    const { error } = await supabase
      .from("order_documents")
      .delete()
      .eq("id", document.id);

    if (error) return error.message;

    await supabase.storage
      .from(ORDER_DOCUMENTS_BUCKET)
      .remove([document.storage_path]);

    state.setData(previous =>
      previous.filter(item => item.id !== document.id),
    );

    return null;
  };

  const downloadDocument = async (
    document: OrderDocumentRow,
  ): Promise<string | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase.storage
      .from(ORDER_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storage_path, 60);

    if (error || !data) return null;
    return data.signedUrl;
  };

  return {
    documents: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    uploadDocument,
    removeDocument,
    downloadDocument,
  };
}

export function useOrderOperationsAudit(orderId: string) {
  const fetchAudit = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };

    const { data, error } = await supabase
      .from("order_operations_audit")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };

    const parsed =
      OrderOperationsAuditRowSchema.array().safeParse(
        data ?? [],
      );

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [orderId]);

  const state = useAsyncResource(fetchAudit, [orderId], {
    initialData: [] as ReturnType<
      typeof OrderOperationsAuditRowSchema.parse
    >[],
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return {
    events: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}

export function useOrderCompletionCheck(orderId: string) {
  const fetchCheck = useCallback(async () => {
    if (!supabase) return { data: null, error: NOT_CONFIGURED };

    const { data, error } = await supabase.rpc(
      "order_completion_check",
      { p_order_id: orderId },
    );

    if (error) return { data: null, error: error.message };

    const parsed = OrderCompletionCheckSchema.safeParse(data);

    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: null, error: BAD_SHAPE };
  }, [orderId]);

  const state = useAsyncResource(fetchCheck, [orderId], {
    initialData: null as ReturnType<
      typeof OrderCompletionCheckSchema.parse
    > | null,
    skip: !orderId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return {
    check: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}
