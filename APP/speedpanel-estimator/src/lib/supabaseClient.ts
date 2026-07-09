// =============================================================================
// Supabase client
// =============================================================================
// `supabase` is null whenever the env vars below aren't set OR are malformed,
// so importing this file is always safe -- nothing here throws. This module
// is imported (transitively) by App.tsx for every route, not just Admin --
// there's no code-splitting, so a throw here would blank the entire site, not
// just the admin pages. createClient() itself throws synchronously on a
// malformed URL (e.g. missing "https://", or accidentally pasted with
// surrounding quotes -- an easy mistake when pasting into a GitHub secret
// box), so its call is wrapped rather than trusted to always succeed just
// because both env vars are present.
// Publishable/anon key only -- never a service-role/secret key, which must
// never be exposed to a browser bundle.
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function createSupabaseClient(): SupabaseClient | null {
  if (!url || !publishableKey) {
    console.warn("Supabase client not initialized -- VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY are missing from this build. If they were just added in Vercel, a redeploy that reuses the previous build cache won't pick them up -- trigger a fresh build (new commit, or Redeploy with \"Use existing Build Cache\" unchecked).");
    return null;
  }
  try {
    return createClient(url, publishableKey);
  } catch (err) {
    console.error("Supabase client failed to initialize -- check VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY for stray quotes/whitespace or a missing protocol.", err);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseClient();

export const isSupabaseConfigured = supabase !== null;
