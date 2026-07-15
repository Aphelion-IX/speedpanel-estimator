// =============================================================================
// Kit synthesis
// =============================================================================
// Corner/Shaft wall systems link two walls into one shared "kit" (corner
// post or back-to-back junction, computed once per pair -- see
// ./cornerShaftKits.ts). That pairing isn't its own persisted entity; it's
// two Wall rows with matching wallSystem and a cornerPartnerId/shaftPartnerId
// pointing at each other. This generalizes the "walk once, skip the partner
// via a seen-set" pattern already duplicated in aggregateInternal.ts (project
// totals) and systemBreakdownCard.tsx (per-wall display) into one reusable,
// read-only derivation -- for the Estimate Structure nav (and, later, any
// other UI that wants to list kits as their own selectable items) to consume
// without a fourth copy of the same walk.
// =============================================================================
import { computeCornerPair, computeShaftPair } from "./cornerShaftKits";
import type { CornerPairResult, ShaftPairResult } from "./cornerShaftKits";
import type { SystemConfig } from "../data";
import type { Wall } from "./wall.types";

export interface KitEntry {
  id: string;
  kind: "corner" | "shaft";
  wallAId: number; wallAName: string;
  wallBId: number; wallBName: string;
  result: CornerPairResult | ShaftPairResult;
}

export function synthesizeKits(walls: Wall[], cfg: SystemConfig): KitEntry[] {
  const entries: KitEntry[] = [];
  const seenCorner = new Set<number>(), seenShaft = new Set<number>();

  for (const w of walls) {
    if (w.wallSystem === "corner" && w.cornerPartnerId != null && !seenCorner.has(w.id) && !seenCorner.has(w.cornerPartnerId)) {
      const partner = walls.find(x => x.id === w.cornerPartnerId);
      if (partner) {
        const result = computeCornerPair(w, partner, cfg);
        if (result) {
          entries.push({ id: `corner-${w.id}-${partner.id}`, kind: "corner", wallAId: w.id, wallAName: w.name, wallBId: partner.id, wallBName: partner.name, result });
        }
      }
      seenCorner.add(w.id);
    }
    if (w.wallSystem === "shaft" && w.shaftPartnerId != null && !seenShaft.has(w.id) && !seenShaft.has(w.shaftPartnerId)) {
      const partner = walls.find(x => x.id === w.shaftPartnerId);
      if (partner) {
        const result = computeShaftPair(w, partner, cfg);
        if (result) {
          entries.push({ id: `shaft-${w.id}-${partner.id}`, kind: "shaft", wallAId: w.id, wallAName: w.name, wallBId: partner.id, wallBName: partner.name, result });
        }
      }
      seenShaft.add(w.id);
    }
  }

  return entries;
}

// Shared "Corner Kit 01" / "Shaft Junction 01" label -- 1-based index within
// the kit's own kind, not stored on KitEntry itself since it depends on the
// full kits array's order. Used by both the Estimate Structure nav's rows
// and the Calculator Workspace's title, so they can't drift out of sync.
export function kitLabel(kit: KitEntry, kits: KitEntry[]): string {
  const n = kits.filter(k => k.kind === kit.kind).findIndex(k => k.id === kit.id) + 1;
  return `${kit.kind === "corner" ? "Corner Kit" : "Shaft Junction"} ${String(n).padStart(2, "0")}`;
}
