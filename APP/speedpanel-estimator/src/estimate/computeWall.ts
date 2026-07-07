// =============================================================================
// computeWall -- unified compute core
// =============================================================================
// The single entry point used by both internal and external systems (config-
// driven via SystemConfig). Orchestrates the named steps (geometry, span
// validation, panel pieces, track linear metres, C-track selection, fixings,
// custom schedules) from their own modules in order, returning early the
// moment any step short-circuits with an `exit` value. `compute`/
// `computeExternal` are thin config-bound wrappers (single call sites).
// =============================================================================
import { ceil, r1, r2 } from "./mathUtils";
import { boxesOf } from "./computeUtils";
import { resolveGeometry, geometryNotes, validateSpan } from "./wallGeometry";
import { buildPieces, computeTrackLM, computeHorizCtrack } from "./wallPieces";
import { computeFixings } from "./wallFixings";
import { computeShaftVerticals } from "./shaftVerticals";
import { buildCustomSchedule, buildExtResult } from "./wallSchedule";
import { packPanels, buildOption } from "./packPanels";
import { horizontalJointCoverLM } from "./gableGeometry";
import { HORIZ_CTRACK_STOCK, EXT_ZFLASH_STOCK, EXT_HORIZ_COVER_DIM, FLASH_DIM, INT_CONFIG, EXT_CONFIG } from "../data";
import type { SystemConfig } from "../data";
import type { WallInput, ComputeOut } from "./wall.types";

/** Orchestrator: runs the steps above in order, returning early the moment any step exits. */
export function computeWall(rawInp: WallInput, cfg: SystemConfig): ComputeOut {
  // "Standard wall" horizontal system (see estimate_single_wall.md): a straight
  // wall restrained on all four sides is the defining assumption of the whole
  // spec, so it isn't a user-facing toggle here -- force all edges on rather
  // than trust inp.edges, which may carry a stale partial-restraint selection
  // left over from switching wallSystem or orientation. "Fully engaged S-to-S"
  // is a separate concept the doc doesn't cover, so it's forced off too --
  // otherwise a toggle left on from another wallSystem would combine with
  // Standard wall's fixed C-track section in an unspecified way.
  //
  // "Corner wall" (see estimate_free_corner_wall.md): each run has head+base
  // track plus one supported side (C-track); the free-corner side gets no
  // track/screws/sealant of its own -- that's covered once per pair by the
  // corner kit (computeCornerPair), not per-run. cornerSide picks which side
  // edge is excluded; fullyEngaged is forced off for the same reason as above.
  //
  // Both are Internal-only (!cfg.hasZFlash) -- confirmed scope. Without this
  // check, selecting Standard/Corner wall on the External calculator would
  // silently apply these Internal-specific rules there too, since wallSystem
  // itself doesn't encode internal/external.
  let inp: WallInput = rawInp;
  if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "standard") {
    inp = { ...rawInp, edges: { top: true, bottom: true, left: true, right: true }, fullyEngaged: false };
  } else if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "corner") {
    const cornerSide = rawInp.cornerSide ?? "right";
    inp = {
      ...rawInp,
      edges: { top: true, bottom: true, left: cornerSide !== "left", right: cornerSide !== "right" },
      fullyEngaged: false,
    };
  } else if (!cfg.hasZFlash && rawInp.orient === "horizontal" && rawInp.wallSystem === "shaft") {
    // "Shaft wall" (see estimate_shaft_wall.md): always the 78 mm panel (per
    // user decision, forced regardless of the wall's own type field), all four
    // edges restrained (head, base, both vertical tracks), fullyEngaged forced
    // off for the same reason as Standard/Corner wall.
    inp = { ...rawInp, type: 78, edges: { top: true, bottom: true, left: true, right: true }, fullyEngaged: false };
  }

  const { orient, type, profile } = inp;
  const W = parseFloat(inp.width) || 0;
  if (W <= 0) return { empty: true, warnings: [], notes: [] };

  const geo = resolveGeometry(inp, W);
  if (geo.maxH <= 1e-9) return { empty: true, warnings: ["Wall height must be greater than zero."], notes: [] };

  const { warnings, notes } = geometryNotes(inp, geo, cfg);

  const span = validateSpan(inp, geo, cfg, warnings, notes);
  if (span.exit) return span.exit;
  const { steel, isStackedShaft } = span;

  const forced = inp.forcedStock ? parseFloat(inp.forcedStock) : null;
  const piecesResult = buildPieces(inp, geo, cfg, steel, forced, warnings, notes);
  if (piecesResult.exit) return piecesResult.exit;
  const { pieces, rows } = piecesResult;

  // allowLong suppresses the packPanels 6.0 m hard-cap for cases where pieces can
  // legitimately exceed 6.0 m stock: non-standard profiles (strip heights taper and
  // may be passed to customSchedule, not packPanels) and stacked/shaft horizontal.
  // Steel + standard vertical is excluded here because buildPieces pre-splits those
  // strips at the 6.0 m boundary, so all pieces are already <= 6.0 m before packPanels.
  const allowLong = profile !== "standard" || isStackedShaft;
  const rawCut = packPanels(pieces, forced, cfg.stocks, allowLong);
  const packSize = cfg.packSizeFn(type);
  const chosen = buildOption(rawCut, type);
  if (rawCut.exceeds) warnings.push("Panel exceeds max stock length. Contact Speedpanel.");
  else if (rawCut.tooShort) warnings.push(`Selected length ${r1(forced!)} m is shorter than the longest panel needed.`);
  if (orient === "horizontal" && profile !== "standard") notes.push("Horizontal raked/gable rows are sized to the widest point within each 250 mm row band.");

  const { cLM, jLM, zLM } = computeTrackLM(inp, geo, cfg, warnings);
  const cStock = orient === "horizontal" ? HORIZ_CTRACK_STOCK : cfg.ctrackStockFn(type);
  const cPieces = cLM > 0 ? ceil(cLM / cStock) : 0;
  const jPieces = jLM > 0 ? ceil(jLM / cfg.jtrackStock[0]) : 0;
  const zPieces = zLM > 0 ? ceil(zLM / EXT_ZFLASH_STOCK) : 0;

  const horiz = computeHorizCtrack(inp, geo, cfg, isStackedShaft, notes, warnings);

  const sausages = geo.area > 0 ? Math.ceil(geo.area / cfg.sealantRate) : 0;
  const sealantBoxes = sausages > 0 ? ceil(sausages / cfg.sealantPerBox) : 0;

  // Shaft wall's own protection strip (one length per slab pass + junction,
  // see estimate_shaft_wall.md) replaces the generic head-only strip the other
  // systems use -- so flashLM/flashPieces are suppressed here (headFlash
  // toggle is ignored for Shaft wall; the strip is inherent to the system, not
  // an optional extra).
  const isShaft = !cfg.hasZFlash && orient === "horizontal" && inp.wallSystem === "shaft";
  const externalHorizontalCoverLM = cfg.hasZFlash && orient === "horizontal"
    ? horizontalJointCoverLM(profile, rows, geo.W, geo.leftH, geo.rightH, geo.apex, geo.apexX)
    : 0;
  const flashLM = cfg.hasZFlash && orient === "horizontal"
    ? externalHorizontalCoverLM
    : (inp.headFlash && !isShaft) ? geo.topRun : 0;
  const flashPieces = flashLM > 0 ? ceil(flashLM / cfg.flashStock) : 0;

  const { fix30: fix30Base, fix16, p2pNote, p2pEnhanced } = computeFixings(inp, geo, cfg, rows, isStackedShaft, horiz);

  const shaftResult = isShaft ? computeShaftVerticals(inp, geo, cfg, warnings, notes) : null;
  // Shaft wall's fix30 is entirely the vertical-track screw count (computeFixings
  // returns 0 for it, since that formula needs floors/floor-height it doesn't have).
  const fix30 = shaftResult ? shaftResult.vertTrackScrews : fix30Base;

  const customSchedule = buildCustomSchedule(inp, geo, pieces, packSize, forced);
  const extResult = cfg.hasZFlash ? buildExtResult(rawCut, packSize) : null;

  return {
    empty: false, orient, panelsAcross: geo.panelsAcross, area: r2(geo.area), acrossCount: pieces.length,
    chosen: cfg.hasZFlash ? undefined : chosen,
    result: cfg.hasZFlash ? (extResult ?? undefined) : undefined,
    cLM: r2(cLM), cStock, cPieces, jLM: r2(jLM), jPieces, zLM: r2(zLM), zPieces,
    horizProfile: horiz.horizProfile, horizFix: horiz.horizFix,
    ctrackDim: cfg.ctrackDimFn(type, orient === "horizontal" ? horiz.horizProfile : null),
    jtrackDim: cfg.jtrackDimFn(type),
    flashDim: cfg.hasZFlash && orient === "horizontal" ? EXT_HORIZ_COVER_DIM : FLASH_DIM, flashLM: r2(flashLM), flashPieces,
    fix30, fix16, boxes30: boxesOf(fix30), boxes16: boxesOf(fix16),
    sausages, sealantBoxes, p2pNote, p2pEnhanced,
    warnings, notes, maxH: r2(geo.maxH), customSchedule, rows, pieces,
    ...(shaftResult ? {
      floors: shaftResult.floors,
      vertTrackSection: shaftResult.vertTrackSection,
      vertTrackFixPerCourse: shaftResult.vertTrackFixPerCourse,
      vertTrackOutsideTable: shaftResult.vertTrackOutsideTable,
      vertTrackLM: shaftResult.vertTrackLM,
      vertTrackPieces: shaftResult.vertTrackPieces,
      slabAnchors: shaftResult.slabAnchors,
      slabPassSausages: shaftResult.slabPassSausages,
      slabPassSealantBoxes: shaftResult.slabPassSealantBoxes,
      stripPieces: shaftResult.stripPieces,
      stripLM: shaftResult.stripLM,
    } : {}),
  };
}


// Thin wrappers -- single call site, config-driven
export const compute         = (inp: WallInput): ComputeOut => computeWall(inp, INT_CONFIG);
export const computeExternal = (inp: WallInput): ComputeOut => computeWall(inp, EXT_CONFIG);
