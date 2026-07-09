// =============================================================================
// Admin Requests -- row types
// =============================================================================
// Mirrors the requests table's columns (see supabase/schema.sql) -- unlike
// Products/Documents/Systems, there's no localStorage seed here; rows come
// straight from a live Supabase read via requestsStore.ts.
//
// AdminRequestRow is a Zod schema (not a plain interface) so requestsStore.ts
// can validate what actually comes back from Supabase -- see
// admin/products/productMappers.ts's header comment for why.
// =============================================================================
import { z } from "zod";

export const REQUEST_STATUSES = ["new", "contacted", "closed"] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

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
  status: z.enum(REQUEST_STATUSES),
});
export type AdminRequestRow = z.infer<typeof AdminRequestRowSchema>;
