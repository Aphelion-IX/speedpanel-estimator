// =============================================================================
// Quote request submission
// =============================================================================
// Public, non-admin -- called from ProjectsPage.tsx's "Request a Quote" form.
// Anonymous visitors have no session, so this relies on the requests table's
// "Public insert access" RLS policy (see supabase/schema.sql) rather than any
// auth check. projectSnapshot, when provided, is stored as-is (unvalidated)
// in the project_snapshot jsonb column -- see src/wallStore.ts's
// PersistedProject for its shape.
// =============================================================================
import { supabase } from "./supabaseClient";
import type { PersistedProject } from "../wallStore";

export interface SubmitRequestInput {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  projectSnapshot?: PersistedProject | null;
}

export async function submitRequest(input: SubmitRequestInput): Promise<string | null> {
  if (!supabase) return "Requests aren't configured for this environment.";
  const { error } = await supabase.from("requests").insert({
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message || null,
    project_snapshot: input.projectSnapshot ?? null,
  });
  return error ? error.message : null;
}
