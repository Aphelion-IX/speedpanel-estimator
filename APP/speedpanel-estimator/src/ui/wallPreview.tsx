// =============================================================================
// Wall preview box
// =============================================================================
// Schematic SVG preview of the active wall's panel grid (columns for vertical
// walls, rows for horizontal), covering all three profiles plus shaft floor
// markers. Grid-outline only -- no dimension labels, restrained-edge
// highlighting, or cut/spare colouring (see wallPreviewGeometry.ts for the
// derivation and its documented simplifications). Rendered once per wall card
// (scoped to the single active wall, not looped over the wall list), so cost
// is negligible.
// =============================================================================
import { useMemo } from "react";
import { cx, BLUE, GOLD } from "../styleTokens";
import { buildPreviewGrid } from "../estimate/wallPreviewGeometry";
import type { Wall, ComputeOut } from "../estimate/wall.types";

const PAD = 0.05; // metres of viewBox padding so edge strokes aren't clipped

export const WallPreviewSection = ({ active, walls, out }: { active: Wall; walls: Wall[]; out: ComputeOut }) => {
  const grid = useMemo(() => buildPreviewGrid(active), [active]);

  const cornerPartner = active.wallSystem === "corner" && active.cornerPartnerId != null
    ? walls.find(w => w.id === active.cornerPartnerId) : undefined;
  const shaftPartner = active.wallSystem === "shaft" && active.shaftPartnerId != null
    ? walls.find(w => w.id === active.shaftPartnerId) : undefined;

  return (
    <div>
      <div className={cx.cardHd}>Preview</div>
      <div className="h-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {out.empty || !grid.ok ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            Enter dimensions to preview
          </div>
        ) : (
          <WallPreviewSvg active={active} grid={grid} />
        )}
      </div>
      {cornerPartner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Linked corner: <span className="font-semibold">{cornerPartner.name}</span>
        </p>
      )}
      {shaftPartner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Linked shaft partner: <span className="font-semibold">{shaftPartner.name}</span>
        </p>
      )}
    </div>
  );
};

const WallPreviewSvg = ({ active, grid }: { active: Wall; grid: ReturnType<typeof buildPreviewGrid> }) => {
  const { W, maxH, leftH, rightH, outline, cells, floorLines } = grid;
  const toSvgY = (y: number) => maxH - y;

  const cornerEdge = active.wallSystem === "corner" && active.cornerPartnerId != null
    ? (active.cornerSide === "left" ? { x: 0, h: leftH } : { x: W, h: rightH })
    : undefined;

  return (
    <svg viewBox={`${-PAD} ${-PAD} ${W + 2 * PAD} ${maxH + 2 * PAD}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      <polygon
        points={outline.map(([x, y]) => `${x},${toSvgY(y)}`).join(" ")}
        style={{ fill: BLUE, fillOpacity: 0.06, stroke: BLUE, strokeWidth: 1.5 }}
        vectorEffect="non-scaling-stroke"
      />
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x} y={toSvgY(c.y + c.h)} width={c.w} height={c.h}
          style={{ fill: "none", stroke: BLUE, strokeOpacity: 0.45, strokeWidth: 1 }}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {floorLines?.map((y, i) => (
        <line
          key={i} x1={0} y1={toSvgY(y)} x2={W} y2={toSvgY(y)}
          style={{ stroke: GOLD, strokeWidth: 1.5, strokeDasharray: "4 3" }}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {cornerEdge && (
        <line
          x1={cornerEdge.x} y1={toSvgY(0)} x2={cornerEdge.x} y2={toSvgY(cornerEdge.h)}
          style={{ stroke: GOLD, strokeWidth: 3 }}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
};
