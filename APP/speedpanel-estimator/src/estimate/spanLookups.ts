// =============================================================================
// Span-table / section lookups
// =============================================================================
// Table-driven lookups selecting the right C-track / corner-post / shaft-track
// section for a given wall's dimensions (or, for the shaft vertical track,
// floor height alone). See estimate_free_corner_wall.md / estimate_shaft_wall.md.
// =============================================================================
import { PANELS, CORNER_POST_TABLE, SHAFT_TRACK_TABLE } from "../data";

// --- C-track selection (spec Table 3) ----------------------------------------
// Data-driven from PANELS[].horizCtrack: return the first ordered band whose
// W/H envelope contains the wall (the band list is ordered narrower-W/shorter-H
// first, so this reproduces the original spec-table lookup exactly). Returns
// null when W/H is beyond every band (e.g. W > 4.5 m).
export const pickHorizCtrack = (type: number, W: number, H: number) => {
  const panel = PANELS.find(p => p.type === type);
  const band = panel?.horizCtrack.find(b => W <= b.wMax && H <= b.hMax);
  return band ? { t: band.section, fix: band.fix, outsideTable: !!band.outsideTable } : null;
};

// --- Corner post selection (Corner wall system, spec Table B) ----------------
// See estimate_free_corner_wall.md section 3. Unlike pickHorizCtrack's exact
// interval bands, this is a simple row/column step-up lookup: find the first
// width column >= W and the first height row >= H, read that cell. If W or H
// exceeds every column/row, it's outside the table (caller shows a warning).
export interface CornerPostResult { section: string; fixPerCourse: 1 | 2; outsideTable: boolean; }

// CORNER_POST_TABLE now lives in ./data (derived from the PANELS catalog).
export const pickCornerPost = (type: number, W: number, H: number): CornerPostResult | null => {
  // P78 footnote (dagger/double-dagger in the doc): at 6.0 m tall the 1-screw/
  // course width breakpoint shifts from 3.0 m to 3.5 m -- handle this exact
  // height band separately since it doesn't fit the rectangular column/row grid.
  if (type === 78 && H > 4.5 + 1e-9 && H <= 6.0 + 1e-9) {
    if (W <= 3.5 + 1e-9) return { section: "90 x 84 x 1.95", fixPerCourse: 1, outsideTable: false };
    if (W <= 4.5 + 1e-9) return { section: "90 x 84 x 1.95", fixPerCourse: 2, outsideTable: false };
    return { section: "90 x 84 x 1.95", fixPerCourse: 2, outsideTable: true };
  }
  const cols = CORNER_POST_TABLE[type];
  if (!cols) return null;
  const col = cols.find(c => W <= c.maxW + 1e-9);
  if (!col) return { section: cols[cols.length - 1].rows[cols[cols.length - 1].rows.length - 1].section, fixPerCourse: 1, outsideTable: true };
  const row = col.rows.find(r => H <= r.maxH + 1e-9);
  if (!row) return { section: col.rows[col.rows.length - 1].section, fixPerCourse: (col.rows[col.rows.length - 1].fixPerCourse ?? 1), outsideTable: true };
  return { section: row.section, fixPerCourse: row.fixPerCourse ?? 1, outsideTable: false };
};

// --- Shaft wall vertical track selection (Table C) ----------------------------
// See estimate_shaft_wall.md section 3. Sized by floor height F alone (not
// width/height like Corner wall's post) -- a step-up lookup, same convention
// as pickCornerPost: find the first floor-height row >= F, read that cell.
export interface ShaftTrackResult { section: string; fixPerCourse: 1 | 2; outsideTable: boolean; }

// SHAFT_TRACK_TABLE now lives in ./data.
export const pickShaftVerticalTrack = (F: number): ShaftTrackResult => {
  const row = SHAFT_TRACK_TABLE.find(r => F <= r.maxF + 1e-9);
  if (!row) { const last = SHAFT_TRACK_TABLE[SHAFT_TRACK_TABLE.length - 1]; return { ...last, outsideTable: true }; }
  return { ...row, outsideTable: false };
};

// --- Tie-break: which of two picked sections is more conservative ------------
// Shared by computeCornerPair (picking between two linked runs' own corner-
// post lookups) and computeShaftPair (same, for the shaft vertical-track
// lookup) -- when two linked walls' own lookups disagree, always step up to
// the stronger/thicker pick. Compared numerically as a tuple of (fixPerCourse,
// BMT, leg, depth) -- fixPerCourse first since 2 screws/course is a stronger
// signal than section size, then the section's three numbers parsed from
// "depth x leg x BMT" (thickest/deepest wins on a tie). This is NOT a string
// comparison -- "90 x 84 x 1.95" vs "90 x 83 x 1.50" must be compared by
// actual parsed magnitude, not lexicographic order, since e.g. BMT "1.5" vs
// "1.15" would sort wrong as strings ("1.15" > "1.5" lexically).
export const moreConservativeSection = <T extends { section: string; fixPerCourse: 1 | 2 }>(x: T, y: T): T => {
  if (x.fixPerCourse !== y.fixPerCourse) return x.fixPerCourse > y.fixPerCourse ? x : y;
  const [xDepth, xLeg, xBmt] = x.section.split(" x ").map(Number);
  const [yDepth, yLeg, yBmt] = y.section.split(" x ").map(Number);
  if (xBmt !== yBmt) return xBmt > yBmt ? x : y;
  if (xLeg !== yLeg) return xLeg > yLeg ? x : y;
  return xDepth >= yDepth ? x : y;
};
