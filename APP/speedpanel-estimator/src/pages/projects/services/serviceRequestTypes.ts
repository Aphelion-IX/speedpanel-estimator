// =============================================================================
// Service requests -- row/data types
// =============================================================================
// Mirrors service_requests/service_request_messages' columns verbatim (see
// supabase/schema.sql's "Support & Services" section) -- same snake_case +
// Zod-schema-per-row convention as projectTypes.ts/orderTypes.ts. This is a
// NEW, separate capability from ReviewActionPanel.tsx's pre-order
// install_review/technical_review design pipeline -- see that section's
// schema comment for why the two are never conflated.
// =============================================================================
import { z } from "zod";
import { tone } from "../../../styleTokens";

export const SERVICE_REQUEST_TYPES = ["technical_review", "pre_start_meeting", "installation_review", "product_warranty"] as const;
export type ServiceRequestType = typeof SERVICE_REQUEST_TYPES[number];

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, string> = {
  technical_review: "Technical Review",
  pre_start_meeting: "Pre-Start Meeting",
  installation_review: "Installation Review",
  product_warranty: "Product Warranty",
};

export const SERVICE_REQUEST_TYPE_DESCRIPTIONS: Record<ServiceRequestType, string> = {
  technical_review: "Ask a technical question, request drawing review or ongoing support.",
  pre_start_meeting: "Request a meeting before work begins on site.",
  installation_review: "Request an on-site installation review.",
  product_warranty: "Request your Speedpanel product warranty.",
};

export const SERVICE_REQUEST_STATUSES = ["draft", "submitted", "assigned", "under_review", "info_required", "response_issued", "closed"] as const;
export type ServiceRequestStatus = typeof SERVICE_REQUEST_STATUSES[number];

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  assigned: "Assigned",
  under_review: "Under Review",
  info_required: "Information Required",
  response_issued: "Response Issued",
  closed: "Closed",
};

export const SERVICE_REQUEST_STATUS_BADGE_CLASS: Record<ServiceRequestStatus, string> = {
  draft: tone("neutral"),
  submitted: tone("info"),
  assigned: tone("info"),
  under_review: tone("warn"),
  info_required: tone("danger"),
  response_issued: tone("ok"),
  closed: tone("neutral"),
};

// Statuses a customer should still consider "open"/awaiting an outcome --
// used for the All Projects "Requires attention" filter/badge.
export const SERVICE_REQUEST_OPEN_STATUSES: ServiceRequestStatus[] = ["submitted", "assigned", "under_review", "info_required"];

export const MeetingDetailsSchema = z.object({
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  meetingType: z.string().optional(),
  attendees: z.string().optional(),
  notes: z.string().optional(),
});
export type MeetingDetails = z.infer<typeof MeetingDetailsSchema>;

export const ServiceRequestRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  company_id: z.string().nullable(),
  created_by: z.string(),
  request_type: z.enum(SERVICE_REQUEST_TYPES),
  status: z.enum(SERVICE_REQUEST_STATUSES),
  category: z.string().nullable(),
  question: z.string().nullable(),
  description: z.string().nullable(),
  drawing_reference: z.string().nullable(),
  meeting_details: MeetingDetailsSchema.nullable(),
  assigned_to: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ServiceRequestRow = z.infer<typeof ServiceRequestRowSchema>;

// Same shape as the backend's service_request_eligibility() jsonb return --
// see supabase/schema.sql. reasonCode/message are absent when available.
export const ServiceEligibilitySchema = z.object({
  available: z.boolean(),
  reasonCode: z.string().optional(),
  message: z.string().optional(),
});
export type ServiceEligibility = z.infer<typeof ServiceEligibilitySchema>;

export const ServiceRequestMessageRowSchema = z.object({
  id: z.string(),
  service_request_id: z.string(),
  author_id: z.string(),
  author_kind: z.enum(["customer", "staff"]),
  body: z.string(),
  created_at: z.string(),
});
export type ServiceRequestMessageRow = z.infer<typeof ServiceRequestMessageRowSchema>;
