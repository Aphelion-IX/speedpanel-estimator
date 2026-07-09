// =============================================================================
// Supabase client
// =============================================================================
// Falls back to this project's own URL/publishable key when
// VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY aren't set in the deploy
// environment -- a Vercel "Redeploy" of an existing deployment can reuse the
// previous cached build output instead of recompiling, so a build that
// predates those env vars being added can otherwise keep shipping silently
// unconfigured. VITE_* env vars, when present, still take priority, so a
// different environment (e.g. staging) can still point elsewhere.
// This is the publishable/anon key, not a service-role/secret key -- it's
// designed to be public (protected by RLS, not secrecy), so hardcoding it
// here as a default is safe.
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://lxfsjntyxpaiqqkpxzlq.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_E7emICigq4iuyRgE_K7p4A_e6p8Yv-x";

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY;

function createSupabaseClient(): SupabaseClient | null {
  try {
    return createClient(url, publishableKey);
  } catch (err) {
    console.error("Supabase client failed to initialize -- check VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY for stray quotes/whitespace or a missing protocol.", err);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseClient();

export const isSupabaseConfigured = supabase !== null;
