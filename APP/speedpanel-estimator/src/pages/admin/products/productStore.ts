// =============================================================================
// Admin Products -- live Supabase fetch
// =============================================================================
// One useSupabaseCatalog instance per table (see shared/supabaseCatalogStore.ts),
// composed into the single five-category ProductCatalog shape the rest of
// this section expects. Gated by panels/tracks/fixings/sealants/colours'
// "Admins can insert/update/delete" RLS policies (see supabase/schema.sql) --
// an unauthenticated or non-admin session gets an error back from Supabase on
// any write attempt.
// =============================================================================
import type { ProductCatalog, ProductCategory, CatalogEntityMap } from "./productTypes";
import {
  PanelRowSchema, fromPanelRow, toPanelRow, TrackRowSchema, fromTrackRow, toTrackRow,
  FixingRowSchema, fromFixingRow, toFixingRow, SealantRowSchema, fromSealantRow, toSealantRow,
  ColourRowSchema, fromColourRow, toColourRow,
} from "./productMappers";
import { useSupabaseCatalog } from "../shared/supabaseCatalogStore";

const NOT_CONFIGURED = "Products aren't configured for this environment.";

export function useProductStore() {
  const panels = useSupabaseCatalog("panels", PanelRowSchema, fromPanelRow, toPanelRow, NOT_CONFIGURED);
  const tracks = useSupabaseCatalog("tracks", TrackRowSchema, fromTrackRow, toTrackRow, NOT_CONFIGURED);
  const fixings = useSupabaseCatalog("fixings", FixingRowSchema, fromFixingRow, toFixingRow, NOT_CONFIGURED);
  const sealants = useSupabaseCatalog("sealants", SealantRowSchema, fromSealantRow, toSealantRow, NOT_CONFIGURED);
  const colours = useSupabaseCatalog("colours", ColourRowSchema, fromColourRow, toColourRow, NOT_CONFIGURED);

  // Untyped at this dispatch boundary on purpose: add<C>/update<C> correlate
  // `category: C` with CatalogEntityMap[C] for their own callers just fine,
  // but a category-keyed lookup of 5 differently-typed catalog instances
  // can't be indexed by a generic C without TS unioning every branch's
  // parameter type together (a known indexed-lookup limitation, not a real
  // type hazard -- each instance's own add/update/remove is still fully
  // typed against its own Row/Entity pair above). Same "one cast needed at
  // this generic-form/typed-store boundary" tradeoff AdminProductsPage.tsx's
  // own handleSave already accepts.
  const STORES = { panel: panels, track: tracks, fixing: fixings, sealant: sealants, colour: colours };

  const catalog: ProductCatalog = {
    panels: panels.items, tracks: tracks.items, fixings: fixings.items, sealants: sealants.items, colours: colours.items,
  };
  const loading = panels.loading || tracks.loading || fixings.loading || sealants.loading || colours.loading;
  const error = panels.error || tracks.error || fixings.error || sealants.error || colours.error;
  const reload = () => { panels.reload(); tracks.reload(); fixings.reload(); sealants.reload(); colours.reload(); };

  const add = <C extends ProductCategory>(
    category: C, item: Omit<CatalogEntityMap[C], "id" | "createdAt" | "updatedAt">,
  ): Promise<{ id: string | null; error: string | null }> => STORES[category].add(item as never);

  const update = <C extends ProductCategory>(
    category: C, id: string, patch: Partial<Omit<CatalogEntityMap[C], "id" | "createdAt">>,
  ): Promise<string | null> => STORES[category].update(id, patch as never);

  const remove = (category: ProductCategory, id: string): Promise<string | null> => STORES[category].remove(id);

  return { catalog, loading, error, reload, add, update, remove };
}
