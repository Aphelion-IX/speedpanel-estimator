// =============================================================================
// Wall geometry + span validation
// =============================================================================
// computeWall's steps 1-2: resolve wall geometry from profile (standard/rake/
// gable), collect geometry-only notes/warnings, and validate height/span
// against the system config's limits (may short-circuit the whole estimate).
// =============================================================================
import { ceil, clamp, numOr0 } from "./mathUtils";
import { gableMaxHeightInBay } from "./gableGeometry";
import { PANEL_WIDTH, STEEL_MAX_H_VERT, SHAFT_MAX_W, MAX_W_HORIZ_STD_51_64 } from "../data";
import type { SystemConfig } from "../data";
import type { WallInput, Geometry, SpanValidation } from "./wall.types";

// SystemConfig + INT_CONFIG/EXT_CONFIG now live in ./data.

// --- Unified compute core -----------------------------------------------------
// computeWall is the single entry point used by both internal and external
// systems (config-driven via SystemConfig). It's broken into named steps below
// so each stage of the estimate -- geometry, span validation, panel pieces,
// track linear metres, C-track selection, fixings, custom schedules -- can be
// read, tested, and modified independently. Steps that can short-circuit the
// whole estimate (geometry, span validation, piece generation) return an
// `exit: ComputeOut | null` field; computeWall checks each one in turn and
// returns early the moment a step produces an exit value.

/** Step 1: resolve wall geometry (edge heights, area, roofline run, strip heights) from profile. */
export function resolveGeometry(inp: WallInput, W: number): Geometry {
  const { orient, profile } = inp;
  const Hin = numOr0(inp.height);
  const panelsAcross = ceil(W / PANEL_WIDTH);
  let leftH = 0, rightH = 0, topRun = 0, area = 0, maxH = 0;
  let apex = 0, apexX = 0;

  if (profile === "standard") {
    leftH = rightH = Hin; topRun = W; area = W * Hin; maxH = Hin;
  } else if (profile === "rake") {
    leftH = numOr0(inp.leftH); rightH = numOr0(inp.rightH);
    topRun = Math.hypot(W, rightH - leftH); area = (W * (leftH + rightH)) / 2; maxH = Math.max(leftH, rightH);
  } else {
    // Gable: left/right eaves heights can differ, and the ridge (apex) can sit
    // anywhere along the width. Existing walls that only set eavesH (legacy
    // centred-symmetric gable) fall back to that single value on both sides.
    const legacyEaves = numOr0(inp.eavesH);
    leftH = parseFloat(inp.leftH) || legacyEaves;
    rightH = parseFloat(inp.rightH) || legacyEaves;
    apex = numOr0(inp.apexH);
    const ridgeRaw = parseFloat(inp.ridgeX);
    apexX = Number.isFinite(ridgeRaw) && ridgeRaw > 0 ? clamp(ridgeRaw, 0, W) : W / 2;
    topRun = Math.hypot(apexX, apex - leftH) + Math.hypot(W - apexX, apex - rightH);
    area = ((leftH + apex) / 2) * apexX + ((apex + rightH) / 2) * (W - apexX);
    maxH = Math.max(leftH, rightH, apex);
  }

  // Strip heights (vertical orientation only -- horizontal builds row widths later).
  // For standard profile every strip is the same height. For rake and gable, each
  // strip is cut to the tallest point within its own width span -- the higher of
  // its two edges (a panel must be tall enough to cover its full bay, not just its
  // centre point; sampling at the centreline would under-cut every panel by half
  // the local rise, since the panel's high edge is always taller than its midpoint
  // on a sloped wall).
  const stripHeights: number[] = [];
  if (orient === "vertical") {
    for (let i = 0; i < panelsAcross; i++) {
      if (profile === "standard") { stripHeights.push(Hin); continue; }
      const startX = i * PANEL_WIDTH;
      const endX = Math.min(W, (i + 1) * PANEL_WIDTH);
      if (profile === "rake") {
        const hAtStart = leftH + (rightH - leftH) * (startX / W);
        const hAtEnd = leftH + (rightH - leftH) * (endX / W);
        stripHeights.push(Math.max(hAtStart, hAtEnd));
      } else {
        stripHeights.push(gableMaxHeightInBay(startX, endX, W, leftH, apex, apexX, rightH));
      }
    }
  }

  return { W, Hin, leftH, rightH, apex, apexX, topRun, area, maxH, panelsAcross, stripHeights };
}

/** Geometry-only warnings/notes that don't gate further computation (gable apex check, profile/gable notes). */
export function geometryNotes(inp: WallInput, geo: Geometry, cfg: SystemConfig): { warnings: string[]; notes: string[] } {
  const { orient, profile } = inp;
  const warnings: string[] = [], notes: string[] = [];
  if (profile === "gable" && geo.apex <= Math.max(geo.leftH, geo.rightH)) {
    warnings.push("Gable apex/ridge height must be greater than both eaves heights.");
  }
  if (profile !== "standard") notes.push(orient === "vertical" ? "Raked/gable/sloped vertical -- estimated only. Confirm with Speedpanel." : "Raked/gable/sloped horizontal -- estimated only. Confirm with Speedpanel.");
  if (profile === "gable" && orient === "vertical") notes.push("Gable panel schedule is numbered left to right in installation order.");
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "standard")
    notes.push("Standard wall: fixed C-track section (no span-table lookup), all four edges restrained.");
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "corner")
    notes.push("Corner wall run: fixed C-track section on the supported side; the free-corner side is covered by the linked corner kit.");
  return { warnings, notes };
}

/** Step 2: height/span validation against the system config's limits. May set `exit` to short-circuit the estimate. */
export function validateSpan(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[], notes: string[]): SpanValidation {
  const { orient, type } = inp;
  const { W, maxH } = geo;
  const steel = !!inp.steelStructure;
  const maxHVert = steel ? STEEL_MAX_H_VERT : cfg.maxHVertFn(type);

  // "Shaft wall" (see estimate_shaft_wall.md), Internal only: total height
  // stacks to any height (no cap), so the standard horizontal maxH/maxW checks
  // below don't apply -- only the width limit (primary <= 5.0 m, the "wider
  // option" ceiling) and the floor-height limit (<= 6.0 m, checked separately
  // in computeShaftVerticals since floorHeight isn't part of Geometry). Note:
  // this is a different concept from the existing isStackedShaft flag below,
  // which is the P78-width-driven "stacked/shaft condition" for the *generic*
  // horizontal system -- unrelated to wallSystem === "shaft".
  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    if (W > SHAFT_MAX_W + 1e-9) {
      warnings.push(`Shaft wall width exceeds the ${SHAFT_MAX_W} m limit. Contact Speedpanel.`);
      return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
      warnings.push("Not all edges restrained -- outside standard shaft config. Contact Speedpanel.");
    return { exit: null, steel, isStackedShaft: false };
  }

  if (orient === "vertical") {
    if (steel) notes.push(`Steel structure: vertical max height raised to ${STEEL_MAX_H_VERT} m.`);
    if (maxH > maxHVert + 1e-9) {
      warnings.push(`Wall height exceeds the ${steel ? `steel structure limit (${STEEL_MAX_H_VERT}m)` : `standard vertical limit for the ${type} mm panel`}. Contact Speedpanel.`);
      if (!steel) return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (maxH > 6.0 + 1e-9 && !steel) warnings.push("Wall height exceeds 6.0 m stock max. Contact Speedpanel.");
    if (maxH > 6.0 + 1e-9 && steel) notes.push("Height exceeds 6m -- panels site-joined. Confirm jointing with Speedpanel.");
    if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
      warnings.push("Not all edges restrained -- outside standard vertical config. Contact Speedpanel.");
    return { exit: null, steel, isStackedShaft: false };
  }

  const isStacked = W > cfg.maxWHoriz + 1e-9 && W <= cfg.maxWStack + 1e-9;
  if (W > cfg.maxWStack + 1e-9) {
    warnings.push(`Wall width exceeds the ${type} mm clear span limit (${cfg.maxWStack} m). Contact Speedpanel.`);
    return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
  }
  // P51/P64 internal additional check
  if (!cfg.hasZFlash && (type === 51 || type === 64)) {
    if (W > cfg.maxWHoriz + 1e-9 || maxH > cfg.maxHHorizFn(type) + 1e-9) {
      warnings.push(`Wall dimensions are outside the calculator scope for the ${type} mm panel. Contact Speedpanel.`);
      return { exit: { empty: true, warnings, notes }, steel, isStackedShaft: false };
    }
    if (W > MAX_W_HORIZ_STD_51_64 + 1e-9) notes.push(`${type} mm panel: width in extended span range (4.0-4.5 m). Special detailing required.`);
  } else {
    if (inp.fullyEngaged) {
      notes.push(`Fully engaged S-to-S: horiz height ${steel ? `unlimited (steel -- max ${STEEL_MAX_H_VERT} m)` : "unlimited"}.`);
      if (steel && maxH > STEEL_MAX_H_VERT + 1e-9) warnings.push(`Wall height exceeds the steel structure maximum (${STEEL_MAX_H_VERT} m).`);
    } else if (isStacked) {
      notes.push("78 mm stacked / shaft condition. Height is treated as unlimited for material estimating only.");
    } else if (maxH > cfg.maxHHorizFn(type) + 1e-9) {
      warnings.push("Wall height exceeds the standard 6.0 m horizontal limit. Quantities shown are estimated from dimensions entered.");
    }
  }
  if (!inp.edges.top || !inp.edges.bottom || !inp.edges.left || !inp.edges.right)
    warnings.push("Not all edges restrained -- outside standard horizontal config. Contact Speedpanel.");

  return { exit: null, steel, isStackedShaft: isStacked };
}
