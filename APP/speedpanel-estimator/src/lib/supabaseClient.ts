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
//
// sanitizeEnvValue trims whitespace/newlines and strips a pair of wrapping
// quotes -- Vercel's env var UI has no validation, and pasting a value with a
// trailing newline or accidentally wrapped in quotes produces a string
// that's still truthy (so the `||` fallback below never kicks in) but fails
// createClient(), silently taking the whole Supabase backend offline. Seen
// in production: "Environment configured: No" despite the var being set.
// =============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_URL = "https://lxfsjntyxpaiqqkpxzlq.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_E7emICigq4iuyRgE_K7p4A_e6p8Yv-x";

function sanitizeEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  let value = raw.trim();
  const isWrapped = value.length >= 2 && (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
  if (isWrapped) value = value.slice(1, -1).trim();
  return value;
}

const rawUrl = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const url = rawUrl ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`) : DEFAULT_URL;
const publishableKey = sanitizeEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || DEFAULT_PUBLISHABLE_KEY;

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
