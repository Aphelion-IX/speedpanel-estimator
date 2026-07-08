// =============================================================================
// Admin Dashboard -- Supabase backend status card
// =============================================================================
// Read-only indicator of whether Supabase env vars are configured. Products
// (and every other admin section) still runs entirely on localStorage
// regardless of this status -- see src/lib/supabaseClient.ts.
// =============================================================================
import { cx, NAVY } from "../../styleTokens";
import { Row } from "../../ui/primitives";
import { isSupabaseConfigured } from "../../lib/supabaseClient";

export const BackendStatusCard = () => (
  <div className={`${cx.card} mt-3`}>
    <div className="text-sm font-bold" style={{ color: NAVY }}>Supabase backend</div>
    <div className="mt-2 space-y-1">
      <Row k="Environment configured" v={isSupabaseConfigured ? "Yes" : "No"} dim />
      <Row k="Mode" v="Local product catalog" dim />
      <Row k="Status" v={isSupabaseConfigured ? "Supabase ready" : "Not configured"} hl={isSupabaseConfigured} />
    </div>
  </div>
);
