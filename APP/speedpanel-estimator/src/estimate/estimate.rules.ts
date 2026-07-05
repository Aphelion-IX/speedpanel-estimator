// =============================================================================
// Combined-estimate rules
// =============================================================================
// The engineering rules for a wall junction between two linked walls of
// DIFFERENT orientation are not covered by any existing spec table (the
// single-wall and corner/shaft-wall specs only cover one wall system at a
// time). This file names the allowance so it stays a single, visible,
// adjustable assumption rather than a number buried in a calculation --
// exactly the transparency the combined-estimate flow is meant to provide.
//
// Convention, matching the existing back-to-back junction used for linked
// Shaft wall pairs (see computeShaftPair in App.tsx): two track lengths run
// back-to-back at the junction, each sized to the taller of the two walls.
// =============================================================================

import { HORIZ_CTRACK_STOCK } from "../data";

/** Track lengths required at a mixed-orientation wall junction (back-to-back). */
export const JUNCTION_TRACK_QUANTITY = 2;

/** Stock length (m) used to convert junction linear metres into orderable pieces. */
export const JUNCTION_TRACK_STOCK = HORIZ_CTRACK_STOCK;

/** Shown on the Connection Breakdown card and in the Easy to Order notes. */
export const JUNCTION_REASON = "Combined wall junction";
