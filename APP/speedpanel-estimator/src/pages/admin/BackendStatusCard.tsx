// =============================================================================
// Admin Dashboard -- Supabase backend status footer
// =============================================================================
// Read-only indicator of whether Supabase env vars are configured. Every
// admin section (Products/Systems/Documents/Maths/Requests/Projects) reads
// and writes live Supabase tables -- see productStore.ts, systemsStore.ts,
// documentStore.ts, mathConstantsStore.ts, requestsStore.ts,
// adminProjectsStore.ts -- gated by supabaseClient.ts's isSupabaseConfigured.
// Rendered as a compact muted footer line (ops diagnostic, not a business
// tile) rather than a full card, to keep it out of the main tile grid.
// =============================================================================
import { cx } from "../../styleTokens";
import { isSupabaseConfigured } from "../../lib/supabaseClient";

export const BackendStatusCard = () => (
  <p className={`${cx.hr} text-sm leading-relaxed text-slate-400 dark:text-slate-500`}>
    Supabase backend: {isSupabaseConfigured ? "ready" : "not configured"}
  </p>
);
