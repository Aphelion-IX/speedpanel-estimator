// =============================================================================
// Shaft wall vertical track
// =============================================================================
// computeWall's step 6b (Shaft wall only, see estimate_shaft_wall.md):
// vertical track sizing, floors, slab-pass sealant/strip -- entirely
// floor-height driven rather than edge-driven like ./wallFixings.ts.
// =============================================================================
import { ceil, r2, numOr0, ceilDiv0 } from "./mathUtils";
import { pickShaftVerticalTrack } from "./spanLookups";
import { PANEL_WIDTH, SHAFT_MAX_F } from "../data";
import type { SystemConfig } from "../data";
import type { WallInput, Geometry } from "./wall.types";

/** Result of Shaft wall's vertical-track/floors/slab-pass calculations (see estimate_shaft_wall.md). */
export interface ShaftResult {
  floors: number;
  vertTrackSection: string; vertTrackFixPerCourse: 1 | 2; vertTrackOutsideTable: boolean;
  vertTrackLM: number; vertTrackPieces: number;
  vertTrackScrews: number;
  slabAnchors: number;
  slabPassSausages: number; slabPassSealantBoxes: number;
  stripPieces: number; stripLM: number;
}

/**
 * Step 6b (Shaft wall only, see estimate_shaft_wall.md): vertical track sizing
 * (by floor height F, not width/height), floors count, vertical-track screws,
 * slab-pass sealant runs, protection strip, and the informational slab-anchor
 * count. Kept separate from computeFixings/computeTrackLM since none of this
 * is edge-driven the way the other systems' track/screw logic is -- it's
 * entirely floors/floor-height driven.
 */
export function computeShaftVerticals(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[], notes: string[]): ShaftResult | null {
  const F = numOr0(inp.floorHeight || "");
  if (F <= 0) { warnings.push("Enter a floor height to size the vertical track."); return null; }
  if (F > SHAFT_MAX_F + 1e-9) warnings.push(`Floor height exceeds the ${SHAFT_MAX_F} m limit. Contact Speedpanel.`);

  const H = geo.maxH; // total shaft height
  // floors: number of slab lifts the vertical tracks pass through. Must round
  // UP (ceil), not to nearest -- a partial floor at the top still needs a full
  // slab crossing (anchor, overlap, protection strip), so rounding to nearest
  // would silently under-count materials whenever H isn't an exact multiple
  // of F (e.g. H=10m, F=3m is 3.33 floors -- that's 4 real slab passes, not 3).
  const floors = Math.max(1, ceil(H / F));

  const track = pickShaftVerticalTrack(F);
  if (track.outsideTable) notes.push(`Floor height exceeds the standard vertical track table. Minimum section selected conservatively as ${track.section} -- confirm with Speedpanel.`);

  // "Buy each vertical length 100 mm longer than the floor lift" -- the +0.1 m
  // per floor is the overlap where tracks pass each slab. Both edges -> x2.
  const vertTrackLM = r2(2 * (H + 0.1 * floors));
  const vertTrackPieces = ceil(vertTrackLM / cfg.stocks[cfg.stocks.length - 1]);

  // Panel-to-track screws, both faces, both vertical edges: (H/0.25) x 4,
  // doubled again if the floor-height table calls for 2 screws/course.
  // NOTE: this follows estimate_shaft_wall.md section 4's formula text exactly.
  // The doc's own worked example (section 5) shows 960 for a 15 m/3 m-floor
  // shaft, which is 4x this formula's 240 -- flagged to the user as a doc
  // inconsistency; use section 4 until confirmed otherwise.
  let vertTrackScrews = ceil(H / PANEL_WIDTH) * 4;
  if (track.fixPerCourse === 2) vertTrackScrews *= 2;

  // Slab-edge anchors: informational only, "by others" -- not a Speedpanel part.
  const slabAnchors = 2 * floors;

  // Slab-pass sealant: "a run at each slab pass" -- a linear seam at each floor
  // crossing, not a panel area, so (like Corner wall's corner seam) it's
  // treated as a 1 m-wide strip at the same rate as the rest of the app:
  // sausages = ceil((W x floors) / cfg.sealantRate). Using W (the seam runs
  // across the wall width at each slab) x number of slab passes.
  const W = geo.W;
  const slabPassSausages = Math.ceil((W * floors) / cfg.sealantRate);
  const slabPassSealantBoxes = ceilDiv0(slabPassSausages, cfg.sealantPerBox);

  // Protection strip: "one length at each slab pass and junction" -- floors-
  // driven (one per floor lift), each cut to the wall width W, not the
  // H-driven head-only strip the other systems use.
  const stripLM = r2(W * floors);
  const stripPieces = ceil(stripLM / cfg.flashStock);

  return {
    floors,
    vertTrackSection: track.section, vertTrackFixPerCourse: track.fixPerCourse, vertTrackOutsideTable: track.outsideTable,
    vertTrackLM, vertTrackPieces, vertTrackScrews,
    slabAnchors, slabPassSausages, slabPassSealantBoxes,
    stripPieces, stripLM,
  };
}
