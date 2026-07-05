// =============================================================================
// Speedpanel product data -- single source of truth
// =============================================================================
// All product/spec data lives here, separated from the calculation engine and
// UI in App.tsx. To update a spec sheet, edit the values below -- no logic
// changes needed.
//
// -----------------------------------------------------------------------------
// HOW TO ADD A NEW PANEL TYPE (e.g. a P90)
// -----------------------------------------------------------------------------
// 1. Add its value to the `PanelType` union just below.
// 2. Add one entry to the `PANELS` array with ALL fields -- TypeScript will
//    error until every field is filled in. That single entry drives the pack
//    size, C-track/J-track dims, max heights, the vertical & horizontal span
//    tables, the corner-post table, the horizontal C-track bands, and the
//    P51/P64/P78 selector buttons.
// 3. A few per-type rules are still IMPERATIVE in App.tsx's compute engine
//    (they are not pure data). Update them too if the new panel needs
//    different behaviour:
//      - `pickCornerPost`   (App.tsx) -- P78 tall-wall footnote special case
//      - `INT_CONFIG.jValidFn` (below) -- which types get a base J-track (P78 only)
//      - "P78 vertical > 5.0 m enhanced fixing" rule (App.tsx, computeFixings)
//      - "shaft wall forces P78" (App.tsx WallsCard + computeWall)
//      - the External hardcoded "P78" badge (App.tsx ExternalCalculator)
// =============================================================================

// --- Panel catalog ------------------------------------------------------------
export type PanelType = 51 | 64 | 78;

export interface PanelSpec {
  type: PanelType;
  label: string;        // "P51"
  depth: string;        // "51 mm"
  frl: string;          // "-/60/60"
  pack: number;         // panels per pack
  ctrackStock: number;  // vertical C-track stock length (m)
  ctrackDim: string;    // vertical C-track section
  jtrackDim: string;    // J-track section
  maxHVert: number;     // max height, vertical orientation (m)
  maxHHoriz: number;    // max height, horizontal orientation (m)
  spanVert: { maxW: string; maxH: string };
  spanHoriz: { maxW: string; maxH: string; cTrack: string; fix: string; note?: string }[];
  cornerPost: { maxW: number; rows: { maxH: number; section: string; fixPerCourse?: 1 | 2 }[] }[];
  // Horizontal C-track selection (spec Table 3), consumed by pickHorizCtrack.
  // ORDERED bands: the matcher returns the first band where W <= wMax && H <= hMax,
  // so list narrower-W / shorter-H bands first. The last band uses hMax: Infinity
  // with outsideTable: true to cover heights beyond the table.
  horizCtrack: { wMax: number; hMax: number; section: string; fix: 1 | 2; outsideTable?: boolean }[];
}

export const PANELS: PanelSpec[] = [
  {
    type: 51, label: "P51", depth: "51 mm", frl: "-/60/60",
    pack: 21, ctrackStock: 3.0, ctrackDim: "55 x 56 x 55", jtrackDim: "55 x 56 x 90",
    maxHVert: 5.0, maxHHoriz: 5.0,
    spanVert: { maxW: "Unlimited", maxH: "5.0 m" },
    spanHoriz: [
      { maxW: "3.0 m", maxH: "3.0 m", cTrack: "55 x 56 x 1.15", fix: "1/face" },
      { maxW: "4.5 m", maxH: "3.0 m", cTrack: "55 x 57 x 1.50", fix: "1/face" },
      { maxW: "3.0 m", maxH: "4.0 m", cTrack: "55 x 57 x 1.50", fix: "1/face" },
      { maxW: "4.5 m", maxH: "4.0 m", cTrack: "55 x 58 x 1.95", fix: "1/face" },
      { maxW: "4.5 m", maxH: "5.0 m", cTrack: "55 x 58 x 1.95", fix: "1/face" },
    ],
    cornerPost: [
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 56 x 1.15" }, { maxH: 4.0, section: "55 x 57 x 1.50" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 57 x 1.50" }, { maxH: 4.0, section: "55 x 58 x 1.95" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
    ],
    horizCtrack: [
      { wMax: 3.0, hMax: 3.0, section: "55 x 56 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: Infinity, section: "55 x 58 x 1.95", fix: 1, outsideTable: true },
    ],
  },
  {
    type: 64, label: "P64", depth: "64 mm", frl: "-/90/90",
    pack: 17, ctrackStock: 3.0, ctrackDim: "55 x 68 x 55", jtrackDim: "55 x 68 x 90",
    maxHVert: 5.0, maxHHoriz: 5.0,
    spanVert: { maxW: "Unlimited", maxH: "5.0 m" },
    spanHoriz: [
      { maxW: "3.0 m", maxH: "3.0 m", cTrack: "55 x 68 x 1.15", fix: "1/face" },
      { maxW: "4.5 m", maxH: "3.0 m", cTrack: "55 x 69 x 1.50", fix: "1/face" },
      { maxW: "3.0 m", maxH: "4.0 m", cTrack: "55 x 69 x 1.50", fix: "1/face" },
      { maxW: "4.5 m", maxH: "4.0 m", cTrack: "55 x 70 x 1.95", fix: "1/face" },
      { maxW: "4.5 m", maxH: "5.0 m", cTrack: "55 x 70 x 1.95", fix: "1/face" },
    ],
    cornerPost: [
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 68 x 1.15" }, { maxH: 4.0, section: "55 x 69 x 1.50" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 69 x 1.50" }, { maxH: 4.0, section: "55 x 70 x 1.95" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
    ],
    horizCtrack: [
      { wMax: 3.0, hMax: 3.0, section: "55 x 68 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: Infinity, section: "55 x 70 x 1.95", fix: 1, outsideTable: true },
    ],
  },
  {
    type: 78, label: "P78", depth: "78 mm", frl: "-/120/120",
    pack: 14, ctrackStock: 6.0, ctrackDim: "55 x 82 x 55", jtrackDim: "55 x 82 x 90",
    maxHVert: 6.0, maxHHoriz: 6.0,
    spanVert: { maxW: "Unlimited", maxH: "6.0 m" },
    spanHoriz: [
      { maxW: "3.0 m", maxH: "3.0 m", cTrack: "90 x 82 x 1.15", fix: "1/face" },
      { maxW: "4.5 m", maxH: "3.0 m", cTrack: "90 x 83 x 1.50", fix: "1/face" },
      { maxW: "3.0 m", maxH: "4.5 m", cTrack: "90 x 83 x 1.50", fix: "1/face" },
      { maxW: "4.5 m", maxH: "4.5 m", cTrack: "90 x 84 x 1.95", fix: "1/face" },
      { maxW: "3.5 m", maxH: "6.0 m", cTrack: "90 x 84 x 1.95", fix: "1/face" },
      { maxW: "4.5 m", maxH: "6.0 m", cTrack: "90 x 84 x 1.95", fix: "2/face" },
      { maxW: "5.0 m", maxH: "Unlimited", cTrack: "90 x 84 x 1.95", fix: "2/face", note: "Stacked/shaft" },
    ],
    cornerPost: [
      // H <= 4.5 m only -- the H > 4.5 m band (up to 6.0 m) is handled separately
      // in pickCornerPost due to the footnote width-breakpoint shift (3.0 m -> 3.5 m at 6.0 m tall).
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "90 x 82 x 1.15" }, { maxH: 4.5, section: "90 x 83 x 1.50" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "90 x 83 x 1.50" }, { maxH: 4.5, section: "90 x 84 x 1.95" }] },
    ],
    horizCtrack: [
      { wMax: 3.0, hMax: 3.0, section: "90 x 82 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.5, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.5, section: "90 x 84 x 1.95", fix: 1 },
      // P78 tall-wall band: the 1-screw width breakpoint drops to 3.5 m at 4.5-6.0 m tall.
      { wMax: 3.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 2 },
      { wMax: 4.5, hMax: Infinity, section: "90 x 84 x 1.95", fix: 2, outsideTable: true },
    ],
  },
];

// --- Derived per-type lookups (compatibility layer) ---------------------------
// These re-create the flat lookup tables the compute engine + UI expect, from
// the catalog above, so PANELS stays the single source of truth. Do not edit
// these directly -- edit the PANELS entries.
export const PACK: Record<number, number>        = Object.fromEntries(PANELS.map(p => [p.type, p.pack]));
export const CTRACK_STOCK: Record<number, number> = Object.fromEntries(PANELS.map(p => [p.type, p.ctrackStock]));
export const CTRACK_DIM: Record<number, string>  = Object.fromEntries(PANELS.map(p => [p.type, p.ctrackDim]));
export const JTRACK_DIM: Record<number, string>  = Object.fromEntries(PANELS.map(p => [p.type, p.jtrackDim]));
export const MAX_H_VERT: Record<number, number>  = Object.fromEntries(PANELS.map(p => [p.type, p.maxHVert]));
export const MAX_H_HORIZ: Record<number, number> = Object.fromEntries(PANELS.map(p => [p.type, p.maxHHoriz]));
export const SPAN_TABLE_VERT = PANELS.map(p => ({ type: p.label, maxW: p.spanVert.maxW, maxH: p.spanVert.maxH }));
export const SPAN_TABLE_HORIZ: Record<number, PanelSpec["spanHoriz"]> = Object.fromEntries(PANELS.map(p => [p.type, p.spanHoriz]));
export const CORNER_POST_TABLE: Record<number, PanelSpec["cornerPost"]> = Object.fromEntries(PANELS.map(p => [p.type, p.cornerPost]));
export const TYPES = PANELS.map(p => ({ id: p.type, label: p.label, depth: p.depth, frl: p.frl }));

/** Reverse-lookup: which panel type (51/64/78) a given pack size belongs to. */
export const typeFromPackSize = (packSize: number): number =>
  PANELS.find(p => p.pack === packSize)?.type ?? 78;

// --- Internal system constants ------------------------------------------------
export const PANEL_WIDTH = 0.25;
export const STOCK_WASTE_THRESHOLD = 0.20;
export const STOCK_LENGTHS = [2.8, 3.0, 3.3, 3.6, 4.0, 4.2, 4.5, 4.8, 5.2, 6.0];
export const FLASH_STOCK = 3.0;
export const FIX_PER_BOX = 1000;
export const HORIZ_CTRACK_STOCK = 6.0;
export const JTRACK_STOCK = [6.0, 3.6, 3.0];
export const SEALANT_M2_PER_SAUSAGE = 4;
export const SEALANT_PER_BOX = 20;
export const FLASH_DIM = "Head track flashing 0.7 mm BMT x 130 mm GAL";
export const EXT_HORIZ_COVER_DIM = "Horizontal external joint cover flashing";
export const MAX_W_HORIZ = 4.5;
export const MAX_W_HORIZ_STD_51_64 = 4.0;
export const MAX_W_HORIZ_STACK_78 = 5.0;
export const STEEL_MAX_H_VERT = 14.0;
export const CUSTOM_MAX_LENGTH = 9.0;
// Shaft wall (see estimate_shaft_wall.md section 1): widest any single stack
// wall can be is 5.0 m (the "wider option" primary). A linked secondary's own
// sub-limit (2.5 m standard split / 2.0 m wider option) is shown as a note
// rather than hard-enforced here, since primary vs secondary isn't tracked as
// a distinct role -- shaftPartnerId only records that two walls are linked.
export const SHAFT_MAX_W = 5.0;
export const SHAFT_MAX_F = 6.0;

// Shared profile info-note copy (used in both internal and external dimension cards)
export const RAKE_NOTE = "Raked: H = leftH + (rightH - leftH) x (x / W). Estimated only.";
export const HEAD_FLASH_LABEL = "Head track flashing";
export const HEAD_FLASH_SUBLABEL = "(0.7 mm BMT x 130 mm GAL)";

// --- External system constants ------------------------------------------------
export const EXT_STOCK = [3.0, 3.6, 4.2, 4.5, 5.0, 6.0];
export const EXT_PACK = 14;
export const EXT_SEALANT_M2 = 2;
export const EXT_SEALANT_PER_BOX = 20;
export const EXT_ZFLASH_STOCK = 3.0;
export const EXT_JTRACK_STOCK = [3.0, 3.6, 6.0];
export const EXT_CTRACK_STOCK = [3.0, 3.6, 6.0];
export const EXT_MAX_H_VERT = 6.0;
export const EXT_MAX_W_HORIZ = 4.5;
export const EXT_MAX_W_HORIZ_STACK = 5.0;
export const EXT_CTRACK_DIM = "55 x 82 x 55 - 1.15 BMT";
export const EXT_JTRACK_DIM = "J-track 1.15 BMT - weep holes @ 250 mm";
export const EXT_ZFLASH_DIM = "Z-Flashing 78 mm - 0.7 mm BMT (Coloured)";
export const EXT_STOCKED_COLOURS = [
  { label: "Off White",   code: "OW" },
  { label: "Gull Grey",   code: "GG" },
  { label: "Monolith",    code: "MO" },
  { label: "Slate Grey",  code: "SL" },
  { label: "Armour Grey", code: "AG" },
];

export const COLOUR_HEX: Record<string, string> = {
  OW: "#F5F2EC",
  GG: "#9BA4A8",
  MO: "#4A4D52",
  SL: "#6B7278",
  AG: "#3D4147",
};

// --- Corner-post & shaft-track tables -----------------------------------------
// CORNER_POST_TABLE is derived from PANELS above. SHAFT_TRACK_TABLE is not
// per-type (P78-only, sized by floor height F), so it lives here directly.
export const SHAFT_TRACK_TABLE: { maxF: number; section: string; fixPerCourse: 1 | 2 }[] = [
  { maxF: 3.0, section: "90 x 82 x 1.50", fixPerCourse: 1 },
  { maxF: 4.5, section: "90 x 84 x 1.95", fixPerCourse: 1 },
  { maxF: 6.0, section: "90 x 84 x 1.95", fixPerCourse: 2 },
];

// --- SystemConfig: single source of truth for int vs ext differences ---------
export interface SystemConfig {
  stocks: number[];
  packSizeFn: (type: number) => number;
  maxHVertFn: (type: number) => number;
  maxHHorizFn: (type: number) => number;
  maxWHoriz: number;
  maxWStack: number;
  sealantRate: number;
  ctrackStockFn: (type: number) => number;
  jtrackStock: number[];
  jValidFn: (type: number) => boolean;
  hasZFlash: boolean;
  flashStock: number;
  sealantPerBox: number;
  ctrackDimFn: (type: number, horizProfile: string | null) => string;
  jtrackDimFn: (type: number) => string;
}

export const INT_CONFIG: SystemConfig = {
  stocks:          STOCK_LENGTHS,
  packSizeFn:      (t) => PACK[t],
  maxHVertFn:      (t) => MAX_H_VERT[t],
  maxHHorizFn:     (t) => MAX_H_HORIZ[t],
  maxWHoriz:       MAX_W_HORIZ,
  maxWStack:       MAX_W_HORIZ_STACK_78,
  sealantRate:     SEALANT_M2_PER_SAUSAGE,
  ctrackStockFn:   (t) => CTRACK_STOCK[t],
  jtrackStock:     JTRACK_STOCK,
  jValidFn:        (t) => t === 78,
  hasZFlash:       false,
  flashStock:      FLASH_STOCK,
  sealantPerBox:   SEALANT_PER_BOX,
  ctrackDimFn:     (t, hp) => hp || `${CTRACK_DIM[t]} - 1.15 mm BMT`,
  jtrackDimFn:     (t) => `${JTRACK_DIM[t]} - 1.15 mm BMT`,
};

export const EXT_CONFIG: SystemConfig = {
  stocks:          EXT_STOCK,
  packSizeFn:      (_) => EXT_PACK,
  maxHVertFn:      (_) => EXT_MAX_H_VERT,
  maxHHorizFn:     (_) => EXT_MAX_H_VERT,
  maxWHoriz:       EXT_MAX_W_HORIZ,
  maxWStack:       EXT_MAX_W_HORIZ_STACK,
  sealantRate:     EXT_SEALANT_M2,
  ctrackStockFn:   (_) => EXT_CTRACK_STOCK[0],
  jtrackStock:     EXT_JTRACK_STOCK,
  jValidFn:        (_) => true,
  hasZFlash:       true,
  flashStock:      FLASH_STOCK,
  sealantPerBox:   EXT_SEALANT_PER_BOX,
  ctrackDimFn:     (_, hp) => hp || EXT_CTRACK_DIM,
  jtrackDimFn:     (_) => EXT_JTRACK_DIM,
};

// --- Locked system data (display-only reference tables) -----------------------
export const INT_LOCKED = [
  ["Panel width","250 mm (fixed)"],["Stocked lengths","2.8/3.0/3.3/3.6/4.0/4.2/4.5/4.8/5.2/6.0m + custom to 9m"],
  ["Pack sizes","P51=21 - P64=17 - P78=14"],["Vertical C-track 1.15BMT"],
  ["P51","55x56x55mm - 3.0m"],["P64","55x68x55mm - 3.0m"],["P78","55x82x55mm - 3.0/3.6/6.0m"],
  ["J-track (P78)","55x82x90 - 1.15BMT - 3.0/3.6/6.0m"],
  ["Head track flashing 0.7 mm BMT x 130 mm GAL","3.0m"],
  ["Fixings/box","1000 (10g-30 and 10g-16)"],["Sealant","Hilti CP606 - 4m2/sausage - 20/box"],
  ["Vert max H","P51/P64=5.0m - P78=6.0m"],["Horiz max W","P51/P64=4.5m assessed; P78=4.5m general / 5.0m shaft-scissor only"],
  ["Horiz max H","P51/P64=5.0m - P78=6.0m std"],
];
export const EXT_LOCKED = [
  ["Panel","P78 - 250mm wide - coloured only"],["Stocked lengths","3.0/3.6/4.2/4.5/5.0/6.0m"],
  ["Pack size","14 panels/pack"],["C-track","55x82x55 - 1.15BMT"],
  ["Base J-track","1.15BMT - weep holes@250mm"],["Z-Flashing","78mm - 0.7mm BMT - Coloured - 3.0m"],
  ["Sealant","Sikaflex 400 Fire PU - 1 sausage/2m2 - 20/box"],
  ["Max H (vert)","6.0m"],["Max W (horiz)","4.5m std - 5.0m stacked/shaft"],
];
