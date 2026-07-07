// =============================================================================
// Fixings + shaft vertical track
// =============================================================================
// computeWall's step 6 (perimeter/joint screw counts) and step 6b (Shaft wall
// only: vertical track sizing, floors, slab-pass sealant/strip -- entirely
// floor-height driven rather than edge-driven like the rest of this file).
// =============================================================================
import { ceil, r2 } from "./mathUtils";
import { fixingsAlong } from "./computeUtils";
import { pickShaftVerticalTrack } from "./spanLookups";
import { PANEL_WIDTH, SHAFT_MAX_F } from "../data";
import type { SystemConfig } from "../data";
import type { WallInput, Geometry, HorizCtrack, FixingsResult } from "./wall.types";

/** Step 6: fixing screw counts (10g-30mm perimeter/flashing, 10g-16mm panel-to-panel joints). */
export function computeFixings(inp: WallInput, geo: Geometry, cfg: SystemConfig, rows: number, isStackedShaft: boolean, horiz: HorizCtrack): FixingsResult {
  const { orient, type, profile, edges } = inp;
  const { W, Hin, leftH, rightH, topRun, maxH, panelsAcross, stripHeights } = geo;

  // "Standard wall" horizontal system (see estimate_single_wall.md), Internal
  // only (!cfg.hasZFlash): simpler, uniform fixing centres rather than the
  // generic horizontal system's per-edge/span-table-driven pattern below.
  // Perimeter screws are 250 mm centres on both faces around all four sides
  // (edges are already forced on by computeWall's normalization); panel-to-
  // panel screws are 1000 mm centres on one face. All four edges are
  // guaranteed on here, so no edge.top/bottom/left/right gating is needed.
  // Perimeter = topRun + W (base) + leftH + rightH -- topRun/leftH/rightH
  // equal W/maxH/maxH respectively for a standard (non-raked/gable)
  // rectangular wall, matching the doc's "2W + 2H".
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "standard") {
    const edgeFixings = fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25) + fixingsAlong(leftH, 0.25) + fixingsAlong(rightH, 0.25);
    const fix30 = edgeFixings * 2 + (inp.headFlash ? 2 * fixingsAlong(topRun, 0.5) : 0);
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  // "Shaft wall" (see estimate_shaft_wall.md), Internal only (!cfg.hasZFlash):
  // fix30 (panel-to-track) is 0 here -- Shaft wall's only panel-to-track screws
  // are the vertical-track ones, computed in computeShaftVerticals (which has
  // floor height / floors available; this function doesn't) and added into
  // the final fix30 by the computeWall orchestrator. fix16 (panel-to-panel)
  // uses the same uniform 1000 mm/one-face convention as the other systems.
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30: 0, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  // "Corner wall" (see estimate_free_corner_wall.md), Internal only
  // (!cfg.hasZFlash): same uniform 250 mm/both-faces convention as Standard
  // wall, but only across this run's 3 edges (top, bottom, and whichever side
  // isn't the free corner -- computeWall's normalization already set edges
  // accordingly, so summing whichever of leftH/rightH is "on" gives the doc's
  // "2W + H" perimeter for free). The corner side's screws are covered
  // separately, once per pair, by computeCornerPair -- not counted here.
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "corner") {
    const sideFixings = (edges.left ? fixingsAlong(leftH, 0.25) : 0) + (edges.right ? fixingsAlong(rightH, 0.25) : 0);
    const edgeFixings = fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25) + sideFixings;
    const fix30 = edgeFixings * 2 + (inp.headFlash ? 2 * fixingsAlong(topRun, 0.5) : 0);
    const rowJoints = Math.max(0, rows - 1);
    const fix16 = rowJoints * fixingsAlong(W, 1.0);
    return { fix30, fix16, p2pNote: "Joints @1000mm, 1 face.", p2pEnhanced: false };
  }

  const engaged = orient === "horizontal" && type === 78 && inp.fullyEngaged;

  let fix30 = 0;
  if (engaged) {
    fix30 += fixingsAlong(topRun, 0.25) + fixingsAlong(W, 0.25);
    if (edges.left)  fix30 += 2 * fixingsAlong(leftH, 0.25);
    if (edges.right) fix30 += 2 * fixingsAlong(rightH, 0.25);
  } else {
    if (edges.top)    fix30 += fixingsAlong(topRun, 0.5);
    if (edges.bottom) fix30 += fixingsAlong(W, 0.5);
    if (edges.left)   fix30 += 2 * fixingsAlong(leftH, 0.25);
    if (edges.right)  fix30 += 2 * fixingsAlong(rightH, 0.25);
  }
  if (inp.headFlash) fix30 += 2 * fixingsAlong(topRun, 0.5);

  let fix16 = 0, p2pNote = "", p2pEnhanced = false;
  if (orient === "vertical") {
    const joints = Math.max(0, panelsAcross - 1);
    if (!cfg.hasZFlash && type === 78 && Hin > 5.0 + 1e-9 && profile === "standard") {
      for (let j = 0; j < joints; j++) { const sp = j < 2 ? 0.5 : j < 4 ? 0.75 : 1.0; fix16 += fixingsAlong(Hin, sp); }
      p2pNote = "P78 vertical > 5.0 m: enhanced pattern."; p2pEnhanced = true;
    } else if (profile === "standard") {
      fix16 = joints * fixingsAlong(Hin, 1.0); p2pNote = "Joints @1000mm, 1 face.";
    } else {
      for (let j = 0; j < joints; j++) fix16 += fixingsAlong(Math.max(stripHeights[j] || 0, stripHeights[j + 1] || 0), 1.0);
      p2pNote = "Joints @ 1000 mm, sized to local height.";
    }
  } else {
    const rowJoints = Math.max(0, rows - 1);
    const engagedDouble = engaged && maxH > 6.0 + 1e-9;
    const faceMult = !engaged && !isStackedShaft && horiz.horizFix > 1 ? 2 : engagedDouble ? 2 : 1;
    fix16 = rowJoints * fixingsAlong(W, 1.0) * faceMult;
    p2pNote = engagedDouble ? "Horiz joints @1000mm, 2/side (fully engaged, above 6m)." : engaged ? "Horiz joints @1000mm, 1/side." : `Horiz joints @1000mm, ${horiz.horizFix} fixing${horiz.horizFix > 1 ? "s" : ""} each face.`;
  }

  return { fix30, fix16, p2pNote, p2pEnhanced };
}

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
  const F = parseFloat(inp.floorHeight || "") || 0;
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
  const slabPassSealantBoxes = slabPassSausages > 0 ? ceil(slabPassSausages / cfg.sealantPerBox) : 0;

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
