// =============================================================================
// Connection / junction material calculation
// =============================================================================
// Stage 2 of the combined-estimate flow (see estimate.types.ts): materials
// needed where two walls physically meet, separate from each wall's own
// section-level materials (computeWall/aggregate in App.tsx own those).
//
// Only walls the user has explicitly linked via junctionPartnerId are
// considered -- this is an estimating allowance, not a structural
// calculation. It only produces a line item where the linked walls'
// orientations differ (a vertical wall butting into a horizontal one), since
// that is the case neither wall's own edge materials already cover; two
// linked walls of the SAME orientation don't get an extra allowance here
// (same-orientation adjoining walls already have existing dedicated systems --
// Corner wall, Shaft wall -- for their own junction kits).
// =============================================================================

import { r2, ceil, numOr0 } from "./mathUtils";
import { JUNCTION_TRACK_QUANTITY, JUNCTION_TRACK_STOCK, JUNCTION_REASON } from "./estimate.rules";
import type { WallLike, ConnectionMaterial } from "./estimate.types";

export function calculateConnectionMaterials<T extends WallLike>(walls: T[]): ConnectionMaterial[] {
  const out: ConnectionMaterial[] = [];
  const seen = new Set<number>();

  for (const wallA of walls) {
    if (wallA.junctionPartnerId == null || seen.has(wallA.id)) continue;
    const wallB = walls.find(w => w.id === wallA.junctionPartnerId);
    if (!wallB || seen.has(wallB.id)) continue;
    seen.add(wallA.id);
    seen.add(wallB.id);
    if (wallA.orient === wallB.orient) continue;

    const Ha = numOr0(wallA.height);
    const Hb = numOr0(wallB.height);
    const lengthM = Math.max(Ha, Hb);
    if (lengthM <= 0) continue;

    const warnings: string[] = [];
    if (Ha > 0 && Hb > 0 && Math.abs(Ha - Hb) > 1e-9) {
      warnings.push(
        `${wallA.name} and ${wallB.name} have different heights (${r2(Ha)} m vs ${r2(Hb)} m) -- junction sized to the taller wall. Confirm on site.`
      );
    }

    const pieces = ceil((lengthM * JUNCTION_TRACK_QUANTITY) / JUNCTION_TRACK_STOCK);

    out.push({
      id: `${wallA.id}-${wallB.id}`,
      wallAId: wallA.id, wallAName: wallA.name, wallAOrient: wallA.orient,
      wallBId: wallB.id, wallBName: wallB.name, wallBOrient: wallB.orient,
      lengthM: r2(lengthM),
      quantity: JUNCTION_TRACK_QUANTITY,
      stock: JUNCTION_TRACK_STOCK,
      pieces,
      reason: JUNCTION_REASON,
      warnings,
    });
  }

  return out;
}
