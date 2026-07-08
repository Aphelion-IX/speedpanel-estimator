// =============================================================================
// Admin Systems -- seed rows from src/data.ts
// =============================================================================
// The ONLY file in src/pages/admin/systems/ that imports from src/data.ts --
// and only reads INT_LOCKED/EXT_LOCKED, never writes to them. Called lazily,
// once per system, from systemsStore.ts's loadRows() when localStorage is
// empty.
// =============================================================================
import { INT_LOCKED, EXT_LOCKED } from "../../../data";
import type { LockedRow, SystemId } from "./systemsTypes";

export function buildSeedRows(system: SystemId): LockedRow[] {
  const source = system === "internal" ? INT_LOCKED : EXT_LOCKED;
  return source.map(row => row.length === 1 ? { key: row[0], value: "" } : { key: row[0], value: row[1] });
}
