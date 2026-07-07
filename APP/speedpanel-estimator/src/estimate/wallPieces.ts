// =============================================================================
// Wall pieces + track linear metres
// =============================================================================
// computeWall's steps 3-5: build the flat list of panel piece lengths, the
// linear-metre track quantities per edge, and (horizontal-only) select the
// C-track section from the span table.
// =============================================================================
import { ceil, r1, r2 } from "./mathUtils";
import { rowWidthBandMax } from "./gableGeometry";
import { pickHorizCtrack } from "./spanLookups";
import { PANEL_WIDTH } from "../data";
import type { SystemConfig } from "../data";
import type { WallInput, Geometry, PiecesResult, TrackLM, HorizCtrack } from "./wall.types";

/** Step 3: build the flat list of panel piece lengths (one per vertical strip, or one per horizontal row). */
export function buildPieces(inp: WallInput, geo: Geometry, cfg: SystemConfig, steel: boolean, forced: number | null, warnings: string[], notes: string[]): PiecesResult {
  const { orient, profile } = inp;
  const { W, leftH, rightH, apex, apexX, maxH, stripHeights } = geo;
  let pieces: number[] = [], rows = 0;

  if (orient === "vertical") {
    // For steel-structure standard-profile vertical walls, panels taller than the
    // maximum stock length (6.0 m) must be site-joined. Split each strip at the
    // stock boundary so packPanels schedules them as separate cut lengths (e.g. a
    // 9 m strip becomes a 6.0 m piece + a 3.0 m piece). Non-standard profiles
    // (rake/gable) already produce per-strip heights that are naturally <= maxH
    // and are passed to computeCustomSchedule, so no splitting is needed there.
    const maxStock = cfg.stocks[cfg.stocks.length - 1]; // 6.0 m for internal
    for (const h of stripHeights) {
      if (steel && profile === "standard" && h > maxStock + 1e-9) {
        // Divide the strip into as many full-stock sections as needed, plus a remainder.
        let remaining = h;
        while (remaining > 1e-9) {
          pieces.push(Math.min(remaining, maxStock));
          remaining -= maxStock;
        }
      } else {
        pieces.push(h);
      }
    }
  } else {
    rows = ceil(maxH / PANEL_WIDTH);
    const maxStock = forced ?? cfg.stocks[cfg.stocks.length - 1];
    for (let i = 0; i < rows; i++) {
      const yBottom = i * PANEL_WIDTH;
      const yTop = (i + 1) * PANEL_WIDTH;
      const w = rowWidthBandMax(profile, yBottom, yTop, W, leftH, rightH, apex, apexX);
      if (w <= 1e-9) continue;
      if (w > maxStock + 1e-9) {
        warnings.push(`Wall width ${r2(W)} m exceeds max panel length (${r1(maxStock)} m).`);
        return { pieces: [], rows, exit: { empty: true, warnings, notes } };
      }
      pieces.push(w);
    }
  }

  return { pieces, rows, exit: null };
}

/** Step 4: linear-metre track quantities for C-track/J-track/Z-flashing, by edge. */
export function computeTrackLM(inp: WallInput, geo: Geometry, cfg: SystemConfig, warnings: string[]): TrackLM {
  const { orient, type, edges } = inp;
  const { W, leftH, rightH, topRun } = geo;
  const jValid = cfg.jValidFn(type);
  let cLM = 0, jLM = 0, zLM = 0;

  if (!cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft") {
    // "Shaft wall" (see estimate_shaft_wall.md): top+bottom track only (2xW) --
    // the two vertical edges are the dedicated full-height vertical track
    // (sized by floor height, computed separately in computeShaftVerticals),
    // not counted here to avoid double-counting them as ordinary C-track too.
    cLM = r2(2 * W);
  } else if (!cfg.hasZFlash) {
    // Internal: J-track selectable per edge
    if (orient === "vertical" && inp.headFinish   === "J" && !jValid) warnings.push("J-track head finish is P78 only.");
    if (orient === "vertical" && inp.bottomFinish === "J" && !jValid) warnings.push("J-track bottom finish is P78 only.");
    if (orient === "vertical" && (inp.leftFinish === "J" || inp.rightFinish === "J") && !jValid) warnings.push("J-track is P78 only -- side edges estimated as C-track.");
    const useJHead   = orient === "vertical" && inp.headFinish   === "J" && jValid;
    const useJBottom = orient === "vertical" && inp.bottomFinish === "J" && jValid;
    const useJLeft   = orient === "vertical" && inp.leftFinish   === "J" && jValid;
    const useJRight  = orient === "vertical" && inp.rightFinish  === "J" && jValid;
    if (edges.top)    useJHead   ? (jLM += topRun) : (cLM += topRun);
    if (edges.bottom) useJBottom ? (jLM += W)      : (cLM += W);
    if (edges.left)   useJLeft   ? (jLM += leftH)  : (cLM += leftH);
    if (edges.right)  useJRight  ? (jLM += rightH) : (cLM += rightH);
  } else {
    // External: base=J-track+Z-flashing, head+sides=C-track
    cLM = r2((edges.top ? topRun : 0) + (edges.left ? leftH : 0) + (edges.right ? rightH : 0));
    jLM = edges.bottom ? r2(W) : 0;
    zLM = edges.bottom ? r2(W) : 0;
  }

  return { cLM, jLM, zLM };
}

/** Step 5: horizontal-only C-track section selection (span-table lookup, engaged/stacked overrides). */
export function computeHorizCtrack(inp: WallInput, geo: Geometry, cfg: SystemConfig, isStackedShaft: boolean, notes: string[], warnings: string[]): HorizCtrack {
  const { orient, type } = inp;
  const { W, maxH } = geo;
  if (orient !== "horizontal") return { horizProfile: null, horizFix: 1 };

  // "Standard wall", "Corner wall", and "Shaft wall" (Internal only,
  // !cfg.hasZFlash): one fixed C-track section regardless of height -- no
  // span-table lookup (see estimate_single_wall.md, estimate_free_corner_wall.md,
  // estimate_shaft_wall.md). Corner wall's run-level C-track (the supported far
  // end, not the post) and Shaft wall's top+bottom track (not the vertical
  // track, which has its own separate lookup -- pickShaftVerticalTrack, in
  // computeShaftVerticals) both use the same fixed section. horizProfile stays
  // null so ctrackDimFn falls back to CTRACK_DIM[type].
  if (!cfg.hasZFlash && (inp.wallSystem === "standard" || inp.wallSystem === "corner" || inp.wallSystem === "shaft")) return { horizProfile: null, horizFix: 1 };

  const engaged = type === 78 && inp.fullyEngaged;
  if (engaged) return { horizProfile: "90 x 84 x 1.92", horizFix: 1 };
  if (isStackedShaft) return { horizProfile: "Stacked / shaft condition", horizFix: 1 };
  if (W > cfg.maxWHoriz + 1e-9) return { horizProfile: null, horizFix: 1 };

  const p = pickHorizCtrack(type, W, maxH);
  if (!p) {
    warnings.push("Wall size outside the standard horizontal C-track table. Contact Speedpanel.");
    return { horizProfile: null, horizFix: 1 };
  }
  if (p.outsideTable) notes.push(`Height exceeds the standard C-track span table. Minimum section selected conservatively as ${p.t} with ${p.fix} fixing${p.fix > 1 ? "s" : ""} each face -- confirm with Speedpanel.`);
  return { horizProfile: p.t, horizFix: p.fix };
}
