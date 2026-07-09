// =============================================================================
// Quote request submission
// =============================================================================
// Public, non-admin -- called from QuoteRequestPage.tsx's "Request a Quote"
// form. Anonymous visitors have no session, so this relies on the requests
// table's "Public insert access" RLS policy (see supabase/schema.sql) rather
// than any auth check. Unlike every other Zod schema in this app (which
// validates data coming FROM Supabase), this one validates outbound,
// anonymous, arbitrary public input BEFORE it's sent -- the DB's own `not
// null` columns already reject a truly empty name/email, but this gives a
// friendlier error than a raw Postgres message and catches things the DB
// schema can't (a malformed email, an abusively long message) before a
// network round trip. projectSnapshot, when provided, comes from this same
// device's own loadProject() (see wallStore.ts's PersistedProjectSchema),
// which already validates on read -- no need to re-validate it here.
// =============================================================================
import { z } from "zod";
import { supabase } from "./supabaseClient";
import type { PersistedProject } from "../wallStore";

export interface SubmitRequestInput {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  projectSnapshot?: PersistedProject | null;
}

export const SubmitRequestSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().optional(),
  message: z.string().max(5000, "Message is too long -- please shorten it.").optional(),
});

export async function submitRequest(input: SubmitRequestInput): Promise<string | null> {
  if (!supabase) return "Requests aren't configured for this environment.";
  const parsed = SubmitRequestSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Please check the form and try again.";
  const { error } = await supabase.from("requests").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    message: parsed.data.message || null,
    project_snapshot: input.projectSnapshot ?? null,
  });
  return error ? error.message : null;
}
