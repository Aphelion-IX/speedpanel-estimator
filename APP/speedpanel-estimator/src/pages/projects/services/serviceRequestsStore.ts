// =============================================================================
// Service requests -- live Supabase fetch/create/message store
// =============================================================================
// Three independent concerns, each its own hook (same "one hook per concern"
// convention as orders/ordersStore.ts + orders/orderDeliveriesStore.ts):
//  - useProjectServiceRequests: this project's request list.
//  - useServiceEligibility: the four request types' availability, fetched
//    together via service_request_eligibility() (see supabase/schema.sql) --
//    a real server call, not a client-side guess, so a stale/incomplete
//    client-side orders/deliveries fetch can never show an unavailable
//    action as available.
//  - useServiceRequestMessages: one thread's messages, plus posting a reply.
// Fetch/loading/error plumbing lives in useAsyncResource.ts, shared by every
// store in this tree.
// =============================================================================
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAsyncResource } from "../useAsyncResource";
import {
  ServiceRequestRowSchema, ServiceEligibilitySchema, ServiceRequestMessageRowSchema,
  SERVICE_REQUEST_TYPES,
  type ServiceRequestRow, type ServiceEligibility, type ServiceRequestMessageRow,
  type ServiceRequestType, type MeetingDetails,
} from "./serviceRequestTypes";

const NOT_CONFIGURED = "Support requests aren't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export function useProjectServiceRequests(projectId: string) {
  const fetchRequests = useCallback(async (): Promise<{ data: ServiceRequestRow[]; error: string | null }> => {
    if (!supabase) return { data: [], error: null };
    const { data, error } = await supabase.from("service_requests").select("*")
      .eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    const parsed = ServiceRequestRowSchema.array().safeParse(data ?? []);
    return parsed.success ? { data: parsed.data, error: null } : { data: [], error: BAD_SHAPE };
  }, [projectId]);

  const { data: requests, loading, error, reload, setData } = useAsyncResource(fetchRequests, [projectId], {
    initialData: [] as ServiceRequestRow[],
    skip: !supabase,
    skipError: NOT_CONFIGURED,
  });

  const createRequest = async (
    requestType: ServiceRequestType,
    fields: { category?: string; question?: string; description?: string; drawingReference?: string; meetingDetails?: MeetingDetails },
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("create_service_request", {
      p_project_id: projectId,
      p_request_type: requestType,
      p_category: fields.category || null,
      p_question: fields.question || null,
      p_description: fields.description || null,
      p_drawing_reference: fields.drawingReference || null,
      p_meeting_details: fields.meetingDetails ?? null,
    });
    if (error) return error.message;
    await reload();
    return null;
  };

  return { requests, loading, error, reload, createRequest, setData };
}

// Fetches all four types' availability together -- one RPC call per type,
// run in parallel, rather than a client-side re-derivation of
// journeyStage.ts's rules (that logic already lives once, server-side, in
// service_request_eligibility()).
export function useServiceEligibility(projectId: string) {
  const fetchEligibility = useCallback(async (): Promise<{ data: Record<ServiceRequestType, ServiceEligibility>; error: string | null }> => {
    const fallback = Object.fromEntries(SERVICE_REQUEST_TYPES.map(t => [t, { available: false }])) as Record<ServiceRequestType, ServiceEligibility>;
    if (!supabase) return { data: fallback, error: null };
    const results = await Promise.all(SERVICE_REQUEST_TYPES.map(t =>
      supabase!.rpc("service_request_eligibility", { p_project_id: projectId, p_request_type: t }),
    ));
    const firstError = results.find(r => r.error)?.error;
    if (firstError) return { data: fallback, error: firstError.message };
    const entries = SERVICE_REQUEST_TYPES.map((t, i) => {
      const parsed = ServiceEligibilitySchema.safeParse(results[i].data);
      return [t, parsed.success ? parsed.data : { available: false }] as const;
    });
    return { data: Object.fromEntries(entries) as Record<ServiceRequestType, ServiceEligibility>, error: null };
  }, [projectId]);

  const fallback = Object.fromEntries(SERVICE_REQUEST_TYPES.map(t => [t, { available: false } as ServiceEligibility])) as Record<ServiceRequestType, ServiceEligibility>;
  const { data: eligibility, loading, error, reload } = useAsyncResource(fetchEligibility, [projectId], {
    initialData: fallback,
    skip: !supabase,
  });

  return { eligibility, loading, error, reload };
}

export function useServiceRequestMessages(serviceRequestId: string | null) {
  const fetchMessages = useCallback(async (): Promise<{ data: ServiceRequestMessageRow[]; error: string | null }> => {
    if (!supabase || !serviceRequestId) return { data: [], error: null };
    const { data, error } = await supabase.from("service_request_messages").select("*")
      .eq("service_request_id", serviceRequestId).order("created_at", { ascending: true });
    if (error) return { data: [], error: error.message };
    const parsed = ServiceRequestMessageRowSchema.array().safeParse(data ?? []);
    return parsed.success ? { data: parsed.data, error: null } : { data: [], error: BAD_SHAPE };
  }, [serviceRequestId]);

  const { data: messages, loading, error, reload } = useAsyncResource(fetchMessages, [serviceRequestId], {
    initialData: [] as ServiceRequestMessageRow[],
    skip: !supabase || !serviceRequestId,
  });

  const addMessage = async (body: string): Promise<string | null> => {
    if (!supabase || !serviceRequestId) return NOT_CONFIGURED;
    const { error } = await supabase.rpc("add_service_request_message", { p_service_request_id: serviceRequestId, p_body: body });
    if (error) return error.message;
    await reload();
    return null;
  };

  return { messages, loading, error, reload, addMessage };
}
