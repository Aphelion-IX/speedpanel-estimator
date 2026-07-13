// =============================================================================
// Admin Saved Fees -- live Supabase fetch
// =============================================================================
// A single useSupabaseCatalog instance (see shared/supabaseCatalogStore.ts),
// same shape as documents/documentStore.ts -- one flat table, no
// per-category dispatch. Gated by saved_fees' own role-gated RLS (Internal
// Sales read, super_admin write, see supabase/schema.sql) rather than an
// admin_* RPC -- this is the one pricing-adjacent table that genuinely
// reuses useSupabaseCatalog's direct .insert()/.update()/.delete() calls
// as-is. Internal Sales' "Saved Fee" picker in AdminOrdersPage.tsx reuses
// this same hook read-only (their RLS permits select, not write).
// =============================================================================
import { SavedFeeRowSchema, fromSavedFeeRow, toSavedFeeRow } from "./savedFeeTypes";
import { useSupabaseCatalog } from "../shared/supabaseCatalogStore";

const NOT_CONFIGURED = "Saved fees aren't configured for this environment.";

export function useSavedFees() {
  const { items, loading, error, reload, add, update, remove } = useSupabaseCatalog(
    "saved_fees", SavedFeeRowSchema, fromSavedFeeRow, toSavedFeeRow, NOT_CONFIGURED,
    { column: "label", ascending: true },
  );
  return { savedFees: items, loading, error, reload, add, update, remove };
}
