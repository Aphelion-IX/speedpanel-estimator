// =============================================================================
// Requests -- row types
// =============================================================================
// Mirrors the requests table's columns (see supabase/schema.sql) -- unlike
// Products/Documents/Systems, there's no localStorage seed here; rows come
// straight from a live Supabase read via admin/requests/requestsStore.ts
// (staff triage queue) or myRequestsStore.ts (customer's own request
// history, gated by a narrower owner/company RLS policy).
//
// AdminRequestRow is a Zod schema (not a plain interface) so callers can
// validate what actually comes back from Supabase -- see
// admin/products/productMappers.ts's header comment for why. Lives under
// pages/projects/ rather than pages/admin/ since it's no longer
// admin-only -- a customer-facing page reaching into an admin/-namespaced
// path would cut against this app's existing customer/staff separation
// (same reasoning topNav.tsx documents for keeping "admin"/"company" out
// of the top nav).
// =============================================================================
import { z } from "zod";

export const REQUEST_STATUSES = ["new", "contacted", "closed"] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  closed: "Closed",
};

export const REQUEST_STATUS_BADGE_CLASS: Record<RequestStatus, string> = {
  new: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  contacted: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  closed: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
};

export const AdminRequestRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string().nullable(),
  // Deliberately loose, not a strict schema: an unvalidated client snapshot,
  // versioned independently via its own "v" field, that may not match the
  // app's current shape -- see wallStore.ts's PersistedProject.
  project_snapshot: z.record(z.string(), z.unknown()).nullable(),
  // Real FK to a saved project (see supabase/schema.sql), set when the
  // request was submitted from that project's own "Request a quote" button
  // rather than the anonymous flow -- see QuoteRequestPage.tsx.
  project_id: z.string().nullable(),
  status: z.enum(REQUEST_STATUSES),
});
export type AdminRequestRow = z.infer<typeof AdminRequestRowSchema>;
