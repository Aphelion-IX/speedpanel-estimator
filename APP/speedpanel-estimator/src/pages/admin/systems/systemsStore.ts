// =============================================================================
// Admin Systems -- local persistence
// =============================================================================
// Mirrors src/pages/admin/products/productStore.ts's/documents/documentStore.ts's
// pattern: a versioned localStorage payload, load/save guarded with
// typeof window checks + try/catch. Simpler still than Documents -- there's no
// per-row id/CRUD, just two whole-array replacements (one per system), which
// maps directly onto RepeatableRowEditor's existing onChange(rows) contract.
// =============================================================================
import { useState, useEffect } from "react";
import { buildSeedRows } from "./seedFromLockedData";
import type { LockedRow, SystemId } from "./systemsTypes";

const STORAGE_KEY = "speedpanel:adminSystems";

interface PersistedRows { v: number; internal: LockedRow[]; external: LockedRow[]; }

function loadAll(): { internal: LockedRow[]; external: LockedRow[] } {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedRows;
        if (p && p.v === 1 && Array.isArray(p.internal) && Array.isArray(p.external)) {
          return { internal: p.internal, external: p.external };
        }
      }
    } catch { /* ignore parse/access errors, fall through to seed */ }
  }
  return { internal: buildSeedRows("internal"), external: buildSeedRows("external") };
}

function saveAll(internal: LockedRow[], external: LockedRow[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedRows = { v: 1, internal, external };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}

export function useSystemsStore() {
  const [{ internal, external }, setState] = useState(loadAll);

  useEffect(() => { saveAll(internal, external); }, [internal, external]);

  const setRows = (system: SystemId, rows: LockedRow[]): void => {
    setState(s => system === "internal" ? { ...s, internal: rows } : { ...s, external: rows });
  };

  // QA escape hatch -- discards all local edits and restores the data.ts-derived seed.
  const resetToSeed = (): void => setState({ internal: buildSeedRows("internal"), external: buildSeedRows("external") });

  return { internal, external, setRows, resetToSeed };
}
