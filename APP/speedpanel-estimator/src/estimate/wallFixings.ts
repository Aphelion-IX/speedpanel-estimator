// =============================================================================
// Fixings
// =============================================================================
// computeWall's step 6: perimeter/joint screw counts. See ./shaftVerticals.ts
// for step 6b (Shaft wall's floor-height-driven vertical track sizing, which
// is entirely floors/floor-height driven rather than edge-driven like this).
// =============================================================================
import { fixingsAlong } from "./computeUtils";
import type { SystemConfig } from "../data";
import type { WallInput, Geometry, HorizCtrack, FixingsResult } from "./wall.types";

// Head track flashing adds a second perimeter screw run along the top edge,
// both faces -- same addend in all three edge-driven branches below.
const headFlashScrews = (topRun: number, headFlash: boolean): number => (headFlash ? 2 * fixingsAlong(topRun, 0.5) : 0);

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
    const fix30 = edgeFixings * 2 + headFlashScrews(topRun, inp.headFlash);
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
    const fix30 = edgeFixings * 2 + headFlashScrews(topRun, inp.headFlash);
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
  fix30 += headFlashScrews(topRun, inp.headFlash);

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
