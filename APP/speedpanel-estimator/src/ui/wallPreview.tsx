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
//
// size="thumb" -- same geometry (buildPreviewGrid), scaled-down chrome (no
// "Preview" title, no linked-partner footnotes, smaller padding/gutters/
// font) for use as a wall-card/pill thumbnail image instead of the full
// calculator-workspace Preview box. Proportions are still geometry-accurate,
// just smaller -- not a separate/forked renderer.
// =============================================================================
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { cx, BLUE, GOLD, MUTED } from "../styleTokens";
import { buildPreviewGrid } from "../estimate/wallPreviewGeometry";
import type { Wall, ComputeOut } from "../estimate/wall.types";

const PAD = 0.05; // metres of viewBox padding so edge strokes aren't clipped
const CONTENT_H = 150; // px -- fixed height of the wall-drawing area itself (size="full")
const THUMB_CONTENT_H = 90; // px -- same, for size="thumb"

export const WallPreviewSection = ({ active, walls, out, dimUnit, toDisp, size = "full" }: {
  active: Wall; walls: Wall[]; out: ComputeOut; dimUnit: string; toDisp: (m: string) => string;
  size?: "full" | "thumb";
}) => {
  const grid = useMemo(() => buildPreviewGrid(active), [active]);
  const thumb = size === "thumb";

  const cornerPartner = active.wallSystem === "corner" && active.cornerPartnerId != null
    ? walls.find(w => w.id === active.cornerPartnerId) : undefined;
  const shaftPartner = active.wallSystem === "shaft" && active.shaftPartnerId != null
    ? walls.find(w => w.id === active.shaftPartnerId) : undefined;

  const hasRightDim = active.profile !== "standard";
  const hasApex = active.profile === "gable";
  const contentH = thumb ? THUMB_CONTENT_H : CONTENT_H;

  return (
    <div>
      {!thumb && <div className={cx.cardHd}>Preview</div>}
      <div
        className={`${thumb ? "rounded-lg" : "rounded-xl"} border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800`}
        style={thumb ? {
          paddingTop: hasApex ? 14 : 4, paddingBottom: 18,
          paddingLeft: 26, paddingRight: hasRightDim ? 26 : 4,
        } : {
          paddingTop: hasApex ? 22 : 6, paddingBottom: 32,
          paddingLeft: 52, paddingRight: hasRightDim ? 52 : 6,
        }}
      >
        {out.empty || !grid.ok ? (
          <div className={`flex items-center justify-center text-slate-400 dark:text-slate-400 ${thumb ? "text-[10px]" : "text-sm"}`} style={{ height: contentH }}>
            {thumb ? "No preview" : "Enter dimensions to preview"}
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ height: contentH }}>
            <WallPreviewCanvas active={active} grid={grid} dimUnit={dimUnit} toDisp={toDisp} thumb={thumb} />
          </div>
        )}
      </div>
      {!thumb && cornerPartner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
          Linked corner: <span className="font-semibold">{cornerPartner.name}</span>
        </p>
      )}
      {!thumb && shaftPartner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
          Linked shaft partner: <span className="font-semibold">{shaftPartner.name}</span>
        </p>
      )}
    </div>
  );
};

const WallPreviewCanvas = ({ active, grid, dimUnit, toDisp, thumb = false }: {
  active: Wall; grid: ReturnType<typeof buildPreviewGrid>; dimUnit: string; toDisp: (m: string) => string; thumb?: boolean;
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

      {widthLabel && <HorizDim label={widthLabel} thumb={thumb} />}
      {leftLabel && <VertDim label={leftLabel} side="left" topPct={(1 - leftH / maxH) * 100} heightPct={(leftH / maxH) * 100} thumb={thumb} />}
      {rightLabel && <VertDim label={rightLabel} side="right" topPct={(1 - rightH / maxH) * 100} heightPct={(rightH / maxH) * 100} thumb={thumb} />}
      {apexLabel && <ApexTag label={apexLabel} leftPct={(apexX / W) * 100} topPct={(1 - apex / maxH) * 100} thumb={thumb} />}
    </div>
  );
};

// --- Dimension chrome -----------------------------------------------------
// Fixed-px lines/arrowheads/text, positioned by percentage of the canvas div
// (not the SVG's real-unit viewBox), so they read at a constant, legible
// size regardless of how large or small the wall itself is. `thumb` scales
// every constant down for card/pill use -- same proportions, smaller chrome.

const arrowStyle = (dir: "left" | "right" | "up" | "down", thumb: boolean): CSSProperties => {
  const short = thumb ? 2 : 3;
  const long = thumb ? 3 : 4;
  const base: CSSProperties = { position: "absolute", width: 0, height: 0 };
  if (dir === "left")  return { ...base, top: "50%", left: -1, transform: "translateY(-50%)", borderTop: `${short}px solid transparent`, borderBottom: `${short}px solid transparent`, borderRight: `${long}px solid ${MUTED}` };
  if (dir === "right") return { ...base, top: "50%", right: -1, transform: "translateY(-50%)", borderTop: `${short}px solid transparent`, borderBottom: `${short}px solid transparent`, borderLeft: `${long}px solid ${MUTED}` };
  if (dir === "up")    return { ...base, left: "50%", top: -1, transform: "translateX(-50%)", borderLeft: `${short}px solid transparent`, borderRight: `${short}px solid transparent`, borderBottom: `${long}px solid ${MUTED}` };
  return                      { ...base, left: "50%", bottom: -1, transform: "translateX(-50%)", borderLeft: `${short}px solid transparent`, borderRight: `${short}px solid transparent`, borderTop: `${long}px solid ${MUTED}` };
};
const Arrow = ({ dir, thumb = false }: { dir: "left" | "right" | "up" | "down"; thumb?: boolean }) => <span style={arrowStyle(dir, thumb)} />;

const HorizDim = ({ label, thumb = false }: { label: string; thumb?: boolean }) => (
  <div className="pointer-events-none absolute inset-x-0" style={{ bottom: thumb ? -16 : -28 }}>
    <div className="relative h-px" style={{ background: MUTED }}>
      <Arrow dir="left" thumb={thumb} />
      <Arrow dir="right" thumb={thumb} />
    </div>
    <div className={`mt-1 whitespace-nowrap text-center font-semibold ${thumb ? "text-[9px]" : "text-xs"}`} style={{ color: MUTED }}>{label}</div>
  </div>
);

const VertDim = ({ label, side, topPct, heightPct, thumb = false }: { label: string; side: "left" | "right"; topPct: number; heightPct: number; thumb?: boolean }) => (
  <div
    className="pointer-events-none absolute flex items-center gap-1"
    style={{
      top: `${topPct}%`, height: `${heightPct}%`, width: thumb ? 26 : 44,
      ...(side === "left" ? { right: "100%", marginRight: thumb ? 4 : 8, flexDirection: "row-reverse" } : { left: "100%", marginLeft: thumb ? 4 : 8, flexDirection: "row" }),
    }}
  >
    <div className="relative h-full w-px shrink-0" style={{ background: MUTED }}>
      <Arrow dir="up" thumb={thumb} />
      <Arrow dir="down" thumb={thumb} />
    </div>
    <div className={`whitespace-nowrap font-semibold ${thumb ? "text-[9px]" : "text-xs"}`} style={{ color: MUTED }}>{label}</div>
  </div>
);

const ApexTag = ({ label, leftPct, topPct, thumb = false }: { label: string; leftPct: number; topPct: number; thumb?: boolean }) => (
  <div className={`pointer-events-none absolute whitespace-nowrap font-semibold ${thumb ? "text-[9px]" : "text-xs"}`} style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -100%)", color: MUTED, paddingBottom: thumb ? 2 : 4 }}>
    {label}
  </div>
);
