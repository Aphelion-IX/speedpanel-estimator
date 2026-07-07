// =============================================================================
// Gable/rake geometry
// =============================================================================
// Roofline height/width helpers for raked and (asymmetric) gable wall profiles
// -- used both by resolveGeometry (per-strip heights for vertical walls) and
// buildPieces/computeFixings (per-row widths and joint cover for horizontal).
// =============================================================================
import { clamp } from "./mathUtils";
import { PANEL_WIDTH } from "../data";

// Height of an asymmetric gable's roofline at horizontal position x (0..W).
// Left side rises linearly from leftH (at x=0) to apex (at x=ridgeX);
// right side falls linearly from apex (at x=ridgeX) to rightH (at x=W).
export const gableHeightAtX = (x: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  if (W <= 0) return 0;
  const xx = clamp(x, 0, W);
  const xr = clamp(ridgeX, 0, W);
  if (xx <= xr) {
    if (xr <= 1e-9) return apex;
    return leftH + (apex - leftH) * (xx / xr);
  }
  const rightRun = W - xr;
  if (rightRun <= 1e-9) return apex;
  return apex + (rightH - apex) * ((xx - xr) / rightRun);
};

// For a vertical strip spanning [startX, endX), the panel must be cut to the
// tallest point within that span -- which is the higher of its two edges, or
// the ridge height itself if the ridge falls inside the strip.
export const gableMaxHeightInBay = (startX: number, endX: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  const hStart = gableHeightAtX(startX, W, leftH, apex, ridgeX, rightH);
  const hEnd = gableHeightAtX(endX, W, leftH, apex, ridgeX, rightH);
  const ridgeInsideBay = ridgeX >= startX - 1e-9 && ridgeX <= endX + 1e-9;
  return Math.max(hStart, hEnd, ridgeInsideBay ? apex : 0);
};

// Width of a horizontal row at height y for an asymmetric gable: the row spans
// from wherever the left slope crosses y to wherever the right slope crosses y.
export const gableRowWidth = (y: number, W: number, leftH: number, apex: number, ridgeX: number, rightH: number) => {
  if (W <= 0) return 0;
  if (y <= Math.min(leftH, rightH)) return W;
  if (y >= apex) return 0;
  const xr = clamp(ridgeX, 0, W);
  let xLeft = 0;
  if (y > leftH) {
    if (apex <= leftH) return 0;
    xLeft = ((y - leftH) / (apex - leftH)) * xr;
  }
  let xRight = W;
  if (y > rightH) {
    if (apex <= rightH) return 0;
    xRight = W - ((y - rightH) / (apex - rightH)) * (W - xr);
  }
  return Math.max(0, xRight - xLeft);
};

export const rowWidth = (profile: string, y: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) => {
  if (profile === "standard") return W;
  if (profile === "rake") {
    const lo = Math.min(leftH, rightH), hi = Math.max(leftH, rightH);
    if (y <= lo) return W; if (y >= hi) return 0;
    return (W * (hi - y)) / (hi - lo);
  }
  return gableRowWidth(y, W, leftH, apex, apexX, rightH);
};

// Horizontal raked/gable rows must be cut to the widest point inside the
// 250 mm row band, not the centreline width. Centreline sampling can under-cut
// the panel on sloped walls.
export const rowWidthBandMax = (profile: string, yBottom: number, yTop: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) =>
  Math.max(
    rowWidth(profile, yBottom, W, leftH, rightH, apex, apexX),
    rowWidth(profile, yTop, W, leftH, rightH, apex, apexX),
  );

export const horizontalJointCoverLM = (profile: string, rows: number, W: number, leftH: number, rightH: number, apex: number, apexX: number) => {
  let lm = 0;
  for (let j = 1; j < rows; j++) lm += rowWidth(profile, j * PANEL_WIDTH, W, leftH, rightH, apex, apexX);
  return lm;
};
