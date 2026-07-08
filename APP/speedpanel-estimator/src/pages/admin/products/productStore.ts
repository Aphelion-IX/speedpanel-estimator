// =============================================================================
// Admin Products -- local persistence
// =============================================================================
// Mirrors src/wallStore.ts's proven pattern exactly: a versioned localStorage
// payload, load/save guarded with typeof window checks + try/catch, and a hook
// that seeds state from disk and persists on every change. add/update/remove
// return the affected id/void so swapping this hook's body for Supabase calls
// later won't need to change callers.
// =============================================================================
import { useState, useEffect } from "react";
import { buildSeedCatalog } from "./seedFromData";
import { CATEGORY_KEY } from "./productTypes";
import type { ProductCatalog, ProductCategory, CatalogEntityMap } from "./productTypes";

const STORAGE_KEY = "speedpanel:adminProducts";

interface PersistedCatalog extends ProductCatalog { v: number; }

export function loadCatalog(): ProductCatalog {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedCatalog;
        if (p && p.v === 1 && p.panels && p.tracks && p.fixings && p.sealants && p.colours) {
          const { panels, tracks, fixings, sealants, colours } = p;
          return { panels, tracks, fixings, sealants, colours };
        }
      }
    } catch { /* ignore parse/access errors, fall through to seed */ }
  }
  return buildSeedCatalog();
}

export function saveCatalog(catalog: ProductCatalog): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedCatalog = { v: 1, ...catalog };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}

// Generic entity-array update, contained to this file -- the computed
// `[key]` write is only sound because every call site below supplies a value
// of the matching category's entity type.
function withEntities<C extends ProductCategory>(
  catalog: ProductCatalog, category: C, entities: CatalogEntityMap[C][],
): ProductCatalog {
  return { ...catalog, [CATEGORY_KEY[category]]: entities } as ProductCatalog;
}

export function useProductStore() {
  const [catalog, setCatalog] = useState<ProductCatalog>(loadCatalog);

  useEffect(() => { saveCatalog(catalog); }, [catalog]);

  const add = <C extends ProductCategory>(
    category: C, item: Omit<CatalogEntityMap[C], "id" | "createdAt" | "updatedAt">,
  ): string => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const entity = { ...item, id, createdAt: now, updatedAt: now } as CatalogEntityMap[C];
    setCatalog(c => withEntities(c, category, [...(c[CATEGORY_KEY[category]] as CatalogEntityMap[C][]), entity]));
    return id;
  };

  const update = <C extends ProductCategory>(
    category: C, id: string, patch: Partial<Omit<CatalogEntityMap[C], "id" | "createdAt">>,
  ): void => {
    const now = new Date().toISOString();
    setCatalog(c => {
      const list = c[CATEGORY_KEY[category]] as CatalogEntityMap[C][];
      return withEntities(c, category, list.map(item => item.id === id ? { ...item, ...patch, updatedAt: now } : item));
    });
  };

  const remove = (category: ProductCategory, id: string): void => {
    setCatalog(c => {
      const list = c[CATEGORY_KEY[category]] as { id: string }[];
      return { ...c, [CATEGORY_KEY[category]]: list.filter(item => item.id !== id) } as ProductCatalog;
    });
  };

  // QA escape hatch -- discards all local edits and restores the data.ts-derived seed.
  const resetToSeed = (): void => setCatalog(buildSeedCatalog());

  return { catalog, add, update, remove, resetToSeed };
}
