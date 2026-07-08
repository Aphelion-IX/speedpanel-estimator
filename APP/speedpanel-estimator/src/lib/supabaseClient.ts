// =============================================================================
// Supabase client -- foundation only
// =============================================================================
// Not wired to anything yet: Admin > Products keeps reading/writing
// localStorage exactly as before (see src/pages/admin/products/productStore.ts).
// `supabase` is null whenever the env vars below aren't set, so importing this
// file is always safe -- nothing here throws on a missing configuration.
// Publishable/anon key only -- never a service-role/secret key, which must
// never be exposed to a browser bundle.
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;

export const isSupabaseConfigured = supabase !== null;
