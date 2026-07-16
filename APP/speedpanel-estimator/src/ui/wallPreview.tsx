// =============================================================================
// Wall preview box
// =============================================================================
// Schematic SVG preview of the active wall's panel grid (columns for vertical
// walls, rows for horizontal), covering all three profiles plus shaft floor
// markers, with CAD-style dimension lines annotating whatever the user has
// actually entered. Rendered once per wall card (scoped to the single active
// wall, not looped over the wall list), so cost is negligible.
//
// Dimension chrome (lines/arrowheads/text) is plain HTML, not SVG -- the
// SVG's viewBox spans real metres (well under 1 m to 15+ m across different
// walls) and already needed vector-effect="non-scaling-stroke" just to keep
// its own outline/grid strokes a constant screen width; text and arrowheads
// would hit the same problem with no SVG-native fix short of measuring the
// live pixel-per-unit ratio in JS. HTML sidesteps it entirely and matches the
// app's own precedent for proportional visuals (lengthExplorer.tsx's
// div-based waste bar). To make percentage positioning exact (no letterbox
// gaps to account for), the wall itself is drawn in a small inner "canvas"
// div whose CSS aspect-ratio is locked to W/maxH -- every dimension overlay
// element is positioned as a percentage of that same div, so it lines up
// with the SVG underneath it pixel-for-pixel regardless of wall size.
// =============================================================================
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { cx, BLUE, GOLD, MUTED } from "../styleTokens";
import { buildPreviewGrid } from "../estimate/wallPreviewGeometry";
import type { Wall, ComputeOut } from "../estimate/wall.types";

const PAD = 0.05; // metres of viewBox padding so edge strokes aren't clipped
const CONTENT_H = 150; // px -- fixed height of the wall-drawing area itself

export const WallPreviewSection = ({ active, walls, out, dimUnit, toDisp }: {
  active: Wall; walls: Wall[]; out: ComputeOut; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const grid = useMemo(() => buildPreviewGrid(active), [active]);

  const cornerPartner = active.wallSystem === "corner" && active.cornerPartnerId != null
    ? walls.find(w => w.id === active.cornerPartnerId) : undefined;
  const shaftPartner = active.wallSystem === "shaft" && active.shaftPartnerId != null
    ? walls.find(w => w.id === active.shaftPartnerId) : undefined;

  const hasRightDim = active.profile !== "standard";
  const hasApex = active.profile === "gable";

  return (
    <div>
      <div className={cx.cardHd}>Preview</div>
      <div
        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        style={{
          paddingTop: hasApex ? 22 : 6, paddingBottom: 32,
          paddingLeft: 52, paddingRight: hasRightDim ? 52 : 6,
        }}
      >
        {out.empty || !grid.ok ? (
          <div className="flex items-center justify-center text-sm text-slate-400 dark:text-slate-500" style={{ height: CONTENT_H }}>
            Enter dimensions to preview
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ height: CONTENT_H }}>
            <WallPreviewCanvas active={active} grid={grid} dimUnit={dimUnit} toDisp={toDisp} />
          </div>
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

const WallPreviewCanvas = ({ active, grid, dimUnit, toDisp }: {
  active: Wall; grid: ReturnType<typeof buildPreviewGrid>; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const { W, maxH, leftH, rightH, apex, apexX, outline, cells, floorLines } = grid;
  const toSvgY = (y: number) => maxH - y;
  const label = (m: string) => { const d = toDisp(m); return d ? `${d} ${dimUnit}` : null; };

  const cornerEdge = active.wallSystem === "corner" && active.cornerPartnerId != null
    ? (active.cornerSide === "left" ? { x: 0, h: leftH } : { x: W, h: rightH })
    : undefined;

  const widthLabel = label(active.width);
  const leftLabel =
    active.profile === "gable" ? label(active.leftH || active.eavesH) : label(active.profile === "rake" ? active.leftH : active.height);
  const rightLabel = active.profile === "rake" ? label(active.rightH) : active.profile === "gable" ? label(active.rightH || active.eavesH) : null;
  const apexLabel = active.profile === "gable" ? label(active.apexH) : null;

  return (
    <div className="relative" style={{ aspectRatio: `${W} / ${maxH}`, maxWidth: "100%", maxHeight: "100%" }}>
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

      {widthLabel && <HorizDim label={widthLabel} />}
      {leftLabel && <VertDim label={leftLabel} side="left" topPct={(1 - leftH / maxH) * 100} heightPct={(leftH / maxH) * 100} />}
      {rightLabel && <VertDim label={rightLabel} side="right" topPct={(1 - rightH / maxH) * 100} heightPct={(rightH / maxH) * 100} />}
      {apexLabel && <ApexTag label={apexLabel} leftPct={(apexX / W) * 100} topPct={(1 - apex / maxH) * 100} />}
    </div>
  );
};

// --- Dimension chrome -----------------------------------------------------
// Fixed-px lines/arrowheads/text, positioned by percentage of the canvas div
// (not the SVG's real-unit viewBox), so they read at a constant, legible
// size regardless of how large or small the wall itself is.

const arrowStyle = (dir: "left" | "right" | "up" | "down"): CSSProperties => {
  const base: CSSProperties = { position: "absolute", width: 0, height: 0 };
  if (dir === "left")  return { ...base, top: "50%", left: -1, transform: "translateY(-50%)", borderTop: "3px solid transparent", borderBottom: "3px solid transparent", borderRight: `4px solid ${MUTED}` };
  if (dir === "right") return { ...base, top: "50%", right: -1, transform: "translateY(-50%)", borderTop: "3px solid transparent", borderBottom: "3px solid transparent", borderLeft: `4px solid ${MUTED}` };
  if (dir === "up")    return { ...base, left: "50%", top: -1, transform: "translateX(-50%)", borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderBottom: `4px solid ${MUTED}` };
  return                      { ...base, left: "50%", bottom: -1, transform: "translateX(-50%)", borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: `4px solid ${MUTED}` };
};
const Arrow = ({ dir }: { dir: "left" | "right" | "up" | "down" }) => <span style={arrowStyle(dir)} />;

const HorizDim = ({ label }: { label: string }) => (
  <div className="pointer-events-none absolute inset-x-0" style={{ bottom: -28 }}>
    <div className="relative h-px" style={{ background: MUTED }}>
      <Arrow dir="left" />
      <Arrow dir="right" />
    </div>
    <div className="mt-1 whitespace-nowrap text-center text-xs font-semibold" style={{ color: MUTED }}>{label}</div>
  </div>
);

const VertDim = ({ label, side, topPct, heightPct }: { label: string; side: "left" | "right"; topPct: number; heightPct: number }) => (
  <div
    className="pointer-events-none absolute flex items-center gap-1"
    style={{
      top: `${topPct}%`, height: `${heightPct}%`, width: 44,
      ...(side === "left" ? { right: "100%", marginRight: 8, flexDirection: "row-reverse" } : { left: "100%", marginLeft: 8, flexDirection: "row" }),
    }}
  >
    <div className="relative h-full w-px shrink-0" style={{ background: MUTED }}>
      <Arrow dir="up" />
      <Arrow dir="down" />
    </div>
    <div className="whitespace-nowrap text-xs font-semibold" style={{ color: MUTED }}>{label}</div>
  </div>
);

const ApexTag = ({ label, leftPct, topPct }: { label: string; leftPct: number; topPct: number }) => (
  <div className="pointer-events-none absolute whitespace-nowrap text-xs font-semibold" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -100%)", color: MUTED, paddingBottom: 4 }}>
    {label}
  </div>
);
