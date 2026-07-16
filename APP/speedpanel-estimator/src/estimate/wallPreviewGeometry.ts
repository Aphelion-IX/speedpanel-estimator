// =============================================================================
// Wall preview geometry
// =============================================================================
// Pure, framework-free derivation of a drawable panel grid for a wall -- used
// by src/ui/wallPreview.tsx to render the schematic preview box. Deliberately
// separate from the real compute pipeline: ComputeOut.pieces/rows aren't
// positionally addressable (steel site-joins split vertical pieces; horizontal
// rows skip zero-width bands), so this derives fresh, evenly-spaced positions
// from the same geometry primitives resolveGeometry/buildPieces already use.
// Schematic only -- not a to-the-millimetre cut diagram (real panels are fixed
// 0.25 m wide; here columns/rows are spread evenly across the wall so the
// drawn grid always lines up with the outline, even on sloped profiles).
// =============================================================================
import { ceil, numOr0 } from "./mathUtils";
import { resolveGeometry } from "./wallGeometry";
import { gableMaxHeightInBay, rowWidthBandMax } from "./gableGeometry";
import { PANEL_WIDTH } from "../data";
import type { Wall } from "./wallDomain";

export interface PreviewCell { x: number; y: number; w: number; h: number; } // metres, floor-up cartesian (y=0 at base)

export interface PreviewGrid {
  ok: boolean;              // false => nothing sensible to draw
  W: number; maxH: number;  // drawing extents, metres
  leftH: number; rightH: number; // height of the left/right vertical edges (== maxH for standard)
  outline: [number, number][]; // polygon points, floor-up cartesian
  cells: PreviewCell[];        // one rect per panel
  floorLines?: number[];       // shaft only: y-values of slab crossings
}

const EMPTY_GRID = (W: number): PreviewGrid => ({ ok: false, W, maxH: 0, leftH: 0, rightH: 0, outline: [], cells: [] });

/** X-bounds of a horizontal row band at height y, per profile. Mirrors rowWidthBandMax's
 * own width formula but returns both edges (not centred) since a sloped wall's row isn't
 * symmetric about the wall's midline. */
function rowXBoundsAtY(profile: Wall["profile"], y: number, W: number, leftH: number, rightH: number, apex: number, apexX: number): [number, number] {
  if (profile === "standard") return [0, W];
  if (profile === "rake") {
    const lo = Math.min(leftH, rightH), hi = Math.max(leftH, rightH);
    if (y <= lo) return [0, W];
    if (y >= hi) return [0, 0];
    const w = (W * (hi - y)) / (hi - lo);
    return leftH <= rightH ? [W - w, W] : [0, w];
  }
  // gable: each side tapers independently -- mirrors gableRowWidth's internal math.
  if (y <= Math.min(leftH, rightH)) return [0, W];
  if (y >= apex) return [apexX, apexX];
  const xLeft = y <= leftH ? 0 : (apex > leftH ? ((y - leftH) / (apex - leftH)) * apexX : apexX);
  const xRight = y <= rightH ? W : (apex > rightH ? W - ((y - rightH) / (apex - rightH)) * (W - apexX) : apexX);
  return [xLeft, xRight];
}

export function buildPreviewGrid(wall: Wall): PreviewGrid {
  const W = numOr0(wall.width);
  if (W <= 0) return EMPTY_GRID(0);

  const geo = resolveGeometry(wall, W);
  const { leftH, rightH, apex, apexX, maxH, panelsAcross } = geo;
  if (maxH <= 1e-9) return EMPTY_GRID(W);

  const { profile, orient } = wall;
  const outline: [number, number][] =
    profile === "standard" ? [[0, 0], [W, 0], [W, maxH], [0, maxH]] :
    profile === "rake" ? [[0, 0], [W, 0], [W, rightH], [0, leftH]] :
    [[0, 0], [W, 0], [W, rightH], [apexX, apex], [0, leftH]];

  const cells: PreviewCell[] = [];

  if (orient === "vertical") {
    const colW = W / panelsAcross;
    for (let i = 0; i < panelsAcross; i++) {
      const startX = i * colW, endX = (i + 1) * colW;
      const h =
        profile === "standard" ? maxH :
        profile === "rake" ? Math.max(
          leftH + (rightH - leftH) * (startX / W),
          leftH + (rightH - leftH) * (endX / W),
        ) :
        gableMaxHeightInBay(startX, endX, W, leftH, apex, apexX, rightH);
      cells.push({ x: startX, y: 0, w: colW, h });
    }
  } else {
    const rows = Math.max(1, ceil(maxH / PANEL_WIDTH));
    const rowH = maxH / rows;
    for (let j = 0; j < rows; j++) {
      const yBottom = j * rowH, yTop = (j + 1) * rowH;
      const w = rowWidthBandMax(profile, yBottom, yTop, W, leftH, rightH, apex, apexX);
      if (w <= 1e-9) continue;
      const [xLeft, xRight] = rowXBoundsAtY(profile, yBottom, W, leftH, rightH, apex, apexX);
      cells.push({ x: xLeft, y: yBottom, w: xRight - xLeft, h: rowH });
    }
  }

  const grid: PreviewGrid = { ok: true, W, maxH, leftH, rightH, outline, cells };

  if (wall.wallSystem === "shaft") {
    const F = numOr0(wall.floorHeight || "");
    if (F > 0) {
      const floors = Math.max(1, ceil(maxH / F));
      grid.floorLines = Array.from({ length: floors - 1 }, (_, i) => Math.min((i + 1) * F, maxH - 1e-6));
    }
  }

  return grid;
}
