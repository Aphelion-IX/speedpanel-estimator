// =============================================================================
// Admin Documents -- live Supabase fetch
// =============================================================================
// A single useSupabaseCatalog instance (see shared/supabaseCatalogStore.ts) --
// simpler than products/productStore.ts since there's only one table/entity
// type here, no per-category dispatch needed. Gated by admin_documents'
// "Admins can insert/update/delete" RLS policies (see supabase/schema.sql).
// =============================================================================
import { fromDocumentRow, toDocumentRow } from "./documentMappers";
import { useSupabaseCatalog } from "../shared/supabaseCatalogStore";

const NOT_CONFIGURED = "Documents aren't configured for this environment.";

export function useDocumentStore() {
  const { items, loading, error, reload, add, update, remove } = useSupabaseCatalog(
    "admin_documents", fromDocumentRow, toDocumentRow, NOT_CONFIGURED, { column: "created_at", ascending: true },
  );
  return { documents: items, loading, error, reload, add, update, remove };
}
