// =============================================================================
// Admin Maths -- cross-device Supabase sync, layered over the existing
// localStorage-based mathConstants.ts
// =============================================================================
// src/mathConstants.ts's loadMathConstants()/saveMathConstants() stay exactly
// as they are -- src/data.ts calls loadMathConstants() synchronously at
// module-eval time, before React even mounts, and every one of data.ts's
// derived exports depends on that same synchronous read. This hook does NOT
// touch that contract: `draft` seeds from loadMathConstants() synchronously
// (identical instant UX to today), then asynchronously fetches the
// math_constants singleton row in the background and calls the existing
// saveMathConstants() to refresh THIS device's localStorage mirror -- so the
// next reload (here or on any other device) picks up the latest shared
// value. save()/resetToDefaults() write to both Supabase and localStorage.
// Gated by math_constants' "Admins can update" RLS policy.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { loadMathConstants, saveMathConstants, MATH_CONSTANT_DEFAULTS, MathConstantsSchema, type MathConstants } from "../../../mathConstants";

const SINGLETON_ID = "00000000-0000-0000-0000-000000000001";
const BAD_SHAPE = "Unexpected data shape from the server.";
const PartialMathConstantsSchema = MathConstantsSchema.partial();

export function useMathConstantsStore() {
  const [draft, setDraft] = useState<MathConstants>(loadMathConstants);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("math_constants").select("values").eq("id", SINGLETON_ID).single();
      if (cancelled) return;
      if (error) { setError(error.message); setLoading(false); return; }
      const parsed = PartialMathConstantsSchema.safeParse(data?.values);
      if (!parsed.success) { setError(BAD_SHAPE); setLoading(false); return; }
      const merged = { ...MATH_CONSTANT_DEFAULTS, ...parsed.data };
      saveMathConstants(merged);
      setDraft(merged);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (values: MathConstants): Promise<string | null> => {
    // Local persistence always succeeds regardless of Supabase configuration
    // (matching mathConstants.ts's original, Supabase-agnostic contract) --
    // Supabase is an additional cross-device sync layer on top, not a
    // replacement for it, so its absence/failure never blocks a local save.
    // The sync attempt is wrapped in try/catch (not just a returned {error})
    // since a network failure throws rather than resolving -- without this,
    // an unreachable Supabase would skip saveMathConstants() entirely and
    // silently discard the admin's edit instead of just failing to sync it.
    let syncError: string | null = null;
    if (supabase) {
      try {
        const { error } = await supabase.from("math_constants")
          .update({ values, updated_at: new Date().toISOString() }).eq("id", SINGLETON_ID);
        if (error) syncError = error.message;
      } catch (e) {
        syncError = e instanceof Error ? e.message : "Failed to sync to the server.";
      }
    }
    saveMathConstants(values);
    setDraft(values);
    return syncError;
  };

  const resetToDefaults = () => save(MATH_CONSTANT_DEFAULTS);

  return { draft, loading, error, save, resetToDefaults };
}
