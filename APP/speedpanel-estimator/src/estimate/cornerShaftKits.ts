// =============================================================================
// Corner / shaft pair "kits"
// =============================================================================
// Materials shared once per linked pair of Corner-wall or Shaft-wall runs
// (corner post / back-to-back junction, their screws, sealant, and protection
// strip) -- computed from the two linked walls' raw inputs, not their
// ComputeOut, since the post/junction table needs each run's own W/floor
// height plus the pair's shared H directly.
// =============================================================================
import { ceil, r2, numOr0, ceilDiv0 } from "./mathUtils";
import { boxesOf } from "./computeUtils";
import { pickCornerPost, pickShaftVerticalTrack, moreConservativeSection } from "./spanLookups";
import { HORIZ_CTRACK_STOCK, PANEL_WIDTH } from "../data";
import type { SystemConfig } from "../data";
import type { Wall } from "./wall.types";

// --- Corner pair (Corner wall system) -----------------------------------------
// The "corner kit" added once per linked pair of Corner wall runs (see
// estimate_free_corner_wall.md Part 2): the corner post itself, corner screws,
// corner seam sealant, and the corner protection strip. Computed from the two
// linked walls' raw inputs (not their ComputeOut) since the post table needs
// each run's W and the pair's shared H directly.
export interface CornerPairResult {
  section: string; fixPerCourse: 1 | 2; outsideTable: boolean;
  postLM: number; postPieces: number; postStock: number;
  cornerScrews: number; cornerScrewBoxes: number;
  cornerSausages: number; cornerSealantBoxes: number;
  stripLM: number; stripPieces: number;
  H: number; heightMismatch: boolean;
  warnings: string[]; notes: string[];
}

export function computeCornerPair(wallA: Wall, wallB: Wall, cfg: SystemConfig): CornerPairResult | null {
  const Ha = numOr0(wallA.height), Hb = numOr0(wallB.height);
  const Wa = numOr0(wallA.width), Wb = numOr0(wallB.width);
  if (Ha <= 0 || Wa <= 0 || Wb <= 0) return null;

  const warnings: string[] = [], notes: string[] = [];
  const heightMismatch = Hb > 0 && Math.abs(Ha - Hb) > 1e-9;
  if (heightMismatch) warnings.push(`Linked runs have different heights (${r2(Ha)} m vs ${r2(Hb)} m) -- corner post sized to ${wallA.name}'s height. Confirm on site.`);
  const H = Ha; // per user decision: assume equal heights, use the first run's height

  // Corner post is sized to whichever run needs the more conservative post
  // (see user decision: always step up to the larger/thicker of the two
  // runs' own lookups) -- see moreConservativeSection in ./spanLookups.
  const pa = pickCornerPost(wallA.type, Wa, H);
  const pb = pickCornerPost(wallB.type, Wb, H);
  if (!pa && !pb) return null;
  let picked = pa && pb ? moreConservativeSection(pa, pb) : (pa ?? pb)!;
  if (picked.outsideTable) notes.push(`Corner post size outside the standard table -- conservatively selected as ${picked.section}. Confirm with Speedpanel.`);

  const postStock = HORIZ_CTRACK_STOCK;
  const postLM = r2(H);
  const postPieces = ceil(postLM / postStock);

  const courses = ceil(H / PANEL_WIDTH);
  const cornerScrews = courses * picked.fixPerCourse * 2; // both sides of the post
  const cornerScrewBoxes = boxesOf(cornerScrews);

  // Corner seam sealant: a linear seam down both faces, not a panel area, so it
  // doesn't fit cfg.sealantRate's m2/sausage convention directly. Per user
  // decision, treated as a 1 m-wide strip at the same rate as the rest of the
  // app: sausages = ceil((2 x H x 1) / cfg.sealantRate).
  const cornerSausages = Math.ceil((2 * H) / cfg.sealantRate);
  const cornerSealantBoxes = ceilDiv0(cornerSausages, cfg.sealantPerBox);

  const stripLM = r2(H);
  const stripPieces = ceil(stripLM / cfg.flashStock);

  return {
    section: picked.section, fixPerCourse: picked.fixPerCourse, outsideTable: picked.outsideTable,
    postLM, postPieces, postStock,
    cornerScrews, cornerScrewBoxes,
    cornerSausages, cornerSealantBoxes,
    stripLM, stripPieces,
    H, heightMismatch, warnings, notes,
  };
}

// --- Shaft pair (Shaft wall system) --------------------------------------------
// The back-to-back C-track junction shared between a primary and secondary
// split stack wall (see estimate_shaft_wall.md and user clarification -- the
// junction itself isn't named in the doc, but follows the same length/sizing
// convention as the vertical tracks: sized by floor height F, length
// 2x(H+0.1xfloors) since it's two tracks screwed back-to-back). Screws at the
// junction use the same per-edge rate as one vertical track edge.
export interface ShaftPairResult {
  section: string; fixPerCourse: 1 | 2; outsideTable: boolean;
  junctionLM: number; junctionPieces: number; junctionStock: number;
  junctionScrews: number; junctionScrewBoxes: number;
  H: number; floors: number; heightMismatch: boolean;
  warnings: string[]; notes: string[];
}

export function computeShaftPair(wallA: Wall, wallB: Wall, _cfg: SystemConfig): ShaftPairResult | null {
  const Ha = numOr0(wallA.height), Hb = numOr0(wallB.height);
  const Fa = numOr0(wallA.floorHeight || ""), Fb = numOr0(wallB.floorHeight || "");
  if (Ha <= 0 || Fa <= 0) return null;

  const warnings: string[] = [], notes: string[] = [];
  const heightMismatch = Hb > 0 && Math.abs(Ha - Hb) > 1e-9;
  if (heightMismatch) warnings.push(`Linked stack walls have different total heights (${r2(Ha)} m vs ${r2(Hb)} m) -- junction sized to ${wallA.name}'s height. Confirm on site.`);
  const H = Ha; // per the same convention as Corner wall: assume equal, use the first wall's height
  // See computeShaftVerticals for why this must be ceil, not round.
  const floors = Math.max(1, ceil(H / Fa));

  // Junction track section: more conservative of the two walls' own floor-
  // height lookups -- see moreConservativeSection in ./spanLookups (same
  // tie-break approach as computeCornerPair's post pick).
  const ta = pickShaftVerticalTrack(Fa);
  const tb = Fb > 0 ? pickShaftVerticalTrack(Fb) : null;
  const picked = tb ? moreConservativeSection(ta, tb) : ta;
  if (picked.outsideTable) notes.push(`Junction track floor height exceeds the standard table -- conservatively selected as ${picked.section}. Confirm with Speedpanel.`);

  const junctionStock = HORIZ_CTRACK_STOCK;
  const junctionLM = r2(2 * (H + 0.1 * floors));
  const junctionPieces = ceil(junctionLM / junctionStock);

  let junctionScrews = ceil(H / PANEL_WIDTH) * 2; // one edge's worth, both faces
  if (picked.fixPerCourse === 2) junctionScrews *= 2;
  const junctionScrewBoxes = boxesOf(junctionScrews);

  return {
    section: picked.section, fixPerCourse: picked.fixPerCourse, outsideTable: picked.outsideTable,
    junctionLM, junctionPieces, junctionStock,
    junctionScrews, junctionScrewBoxes,
    H, floors, heightMismatch, warnings, notes,
  };
}
