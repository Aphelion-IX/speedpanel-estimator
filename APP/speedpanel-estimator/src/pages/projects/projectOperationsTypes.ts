
import { z } from "zod";
import { tone } from "../../styleTokens";

export const PROJECT_OPERATIONAL_STATUSES = [
  "planning",
  "quote_submitted",
  "invoice_submitted",
  "processing",
  "manufacturing",
  "delivery",
  "completed",
] as const;

export type ProjectOperationalStatus =
  (typeof PROJECT_OPERATIONAL_STATUSES)[number];

export const PROJECT_OPERATIONAL_STATUS_LABELS:
  Record<ProjectOperationalStatus, string> = {
    planning: "Planning",
    quote_submitted: "Quote Submitted",
    invoice_submitted: "Invoice Submitted",
    processing: "Processing",
    manufacturing: "Manufacturing",
    delivery: "Delivery",
    completed: "Completed",
  };

export const PROJECT_OPERATIONAL_STATUS_BADGE_CLASS:
  Record<ProjectOperationalStatus, string> = {
    planning: tone("neutral"),
    quote_submitted: tone("info"),
    invoice_submitted: tone("info"),
    processing: tone("info"),
    manufacturing: tone("info"),
    delivery: tone("info"),
    completed: tone("ok"),
  };

export const ProjectOperationsRowSchema = z.object({
  project_id: z.string(),
  status: z.enum(PROJECT_OPERATIONAL_STATUSES),
  completed_at: z.string().nullable(),
  archived_at: z.string().nullable(),
  version: z.number().int().positive(),
  updated_by: z.string().nullable(),
  updated_at: z.string(),
});
export type ProjectOperationsRow = z.infer<typeof ProjectOperationsRowSchema>;

export const PROJECT_CONTACT_TYPES = [
  "customer_project_manager",
  "site_contact",
  "delivery_contact",
  "accounts_contact",
  "builder_contact",
] as const;
export type ProjectContactType = (typeof PROJECT_CONTACT_TYPES)[number];

export const PROJECT_CONTACT_TYPE_LABELS: Record<ProjectContactType, string> = {
  customer_project_manager: "Customer Project Manager",
  site_contact: "Site Contact",
  delivery_contact: "Delivery Contact",
  accounts_contact: "Accounts Contact",
  builder_contact: "Builder Contact",
};

export const ProjectContactRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  contact_type: z.enum(PROJECT_CONTACT_TYPES),
  company_user_id: z.string().nullable(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProjectContactRow = z.infer<typeof ProjectContactRowSchema>;

export const NOTIFICATION_CHANNELS = [
  "none",
  "in_app",
  "email_and_in_app",
] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const ProjectNotificationPreferencesRowSchema = z.object({
  project_id: z.string(),
  user_id: z.string(),
  orders: z.enum(NOTIFICATION_CHANNELS),
  manufacturing: z.enum(NOTIFICATION_CHANNELS),
  deliveries: z.enum(NOTIFICATION_CHANNELS),
  services: z.enum(NOTIFICATION_CHANNELS),
  updated_at: z.string(),
});
export type ProjectNotificationPreferencesRow =
  z.infer<typeof ProjectNotificationPreferencesRowSchema>;

export const ProjectOperationsAuditRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  actor_user_id: z.string().nullable(),
  event_type: z.string(),
  before_value: z.record(z.string(), z.unknown()).nullable(),
  after_value: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
});
export type ProjectOperationsAuditRow =
  z.infer<typeof ProjectOperationsAuditRowSchema>;

export const ProjectCompletionCheckSchema = z.object({
  canComplete: z.boolean(),
  blockers: z.array(z.string()),
  activeOrders: z.number(),
  undeliveredDeliveries: z.number(),
  ordersWithoutDeliveries: z.number(),
  openServiceRequests: z.number(),
});
export type ProjectCompletionCheck =
  z.infer<typeof ProjectCompletionCheckSchema>;
