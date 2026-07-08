// =============================================================================
// Admin Requests -- row types
// =============================================================================
// Mirrors the requests table's columns (see supabase/schema.sql) -- unlike
// Products/Documents/Systems, there's no localStorage seed here; rows come
// straight from a live Supabase read via requestsStore.ts.
// =============================================================================
export type RequestStatus = "new" | "contacted" | "closed";

export interface AdminRequestRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  // Deliberately not cast to wallStore.ts's PersistedProject -- an
  // unvalidated client snapshot, versioned independently via its own "v"
  // field, that may not match the app's current shape.
  project_snapshot: Record<string, unknown> | null;
  status: RequestStatus;
}
