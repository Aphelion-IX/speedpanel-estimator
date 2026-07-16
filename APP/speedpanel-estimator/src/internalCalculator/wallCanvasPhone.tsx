// =============================================================================
// Wall canvas (phone)
// =============================================================================
// Phone-only wall diagram matching the SpeedHub phone-estimator mockup:
// profile/unit toggle row, an SVG wall outline (reusing the same pure
// geometry ../estimate/wallPreviewGeometry.ts already derives for
// ../ui/wallPreview.tsx), Head/Base/Left/Right edge-restraint pill toggles
// overlaid on the wall outline, and width/height dimension pills. Deliberately
// its own SVG render (not wallPreview.tsx's WallPreviewCanvas, which isn't
// exported and draws CAD-style arrow/line dimension chrome) -- the mockup's
// canvas is plainer: no arrows, just the outline/grid plus editable pills.
// Rake/gable's extra fields (right height, apex, ridge offset) aren't shown
// inline on the canvas in either reference screenshot -- both only ever show
// one height pill -- so they render as a compact block underneath instead,
// reusing the existing Num input.
// =============================================================================
import { BLUE, MUTED, NAVY } from "../styleTokens";
import { buildPreviewGrid } from "../estimate/wallPreviewGeometry";
import { Num, UnitToggle } from "../ui/primitives";
import type { ProfileId } from "../ui/wallConfig";
import type { ComputeOut, DimField, EdgeState, Wall } from "../estimate/wall.types";

const PROFILES: [ProfileId, string][] = [["standard", "Standard"], ["rake", "Raked"], ["gable", "Gable"]];

const ProfilePills = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="flex gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1">
    {PROFILES.map(([id, label]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"rounded-full px-3 py-1.5 text-xs font-bold transition-colors " + (on ? "text-white" : "text-slate-500 dark:text-slate-400")}
          style={on ? { background: NAVY } : undefined}>
          {label}
        </button>
      );
    })}
  </div>
);

const EdgePill = ({ label, on, className, onClick }: { label: string; on: boolean; className: string; onClick: () => void }) => (
  <button onClick={onClick}
    className={`absolute z-[4] rounded-full px-3 py-1.5 text-[11px] font-bold shadow-sm active:scale-95 transition-all ${className} ` +
      (on ? "text-white" : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500")}
    style={on ? { background: BLUE } : undefined}>
    {label}
  </button>
);

export interface WallCanvasPhoneProps {
  active: Wall; out: ComputeOut; dimUnit: string; switchDimUnit: (u: string) => void;
  toDisp: (m: string) => string; updDim: (field: DimField, d: string) => void;
  onProfileChange: (id: ProfileId) => void;
  onEdgeToggle: (k: keyof EdgeState) => void;
}

export const WallCanvasPhone = ({ active, out, dimUnit, switchDimUnit, toDisp, updDim, onProfileChange, onEdgeToggle }: WallCanvasPhoneProps) => {
  const grid = buildPreviewGrid(active);
  const primaryHeightValue =
    active.profile === "standard" ? active.height :
    active.profile === "gable" ? (active.leftH || active.eavesH) :
    active.leftH;

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <ProfilePills value={active.profile} onChange={onProfileChange} />
        <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
      </div>

      <div className="relative mt-3" style={{ height: 232, paddingLeft: 44, paddingBottom: 40, paddingTop: 8, paddingRight: 8 }}>
        {!out.empty && grid.ok ? (
          <div className="flex h-full items-center justify-center">
            <div className="relative" style={{ aspectRatio: `${grid.W} / ${grid.maxH}`, maxWidth: "100%", maxHeight: "100%", width: "100%" }}>
              <svg viewBox={`0 0 ${grid.W} ${grid.maxH}`} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
                <polygon
                  points={grid.outline.map(([x, y]) => `${x},${grid.maxH - y}`).join(" ")}
                  style={{ fill: BLUE, fillOpacity: 0.08, stroke: BLUE, strokeWidth: 2 }}
                  vectorEffect="non-scaling-stroke"
                />
                {grid.cells.map((c, i) => (
                  <rect key={i} x={c.x} y={grid.maxH - (c.y + c.h)} width={c.w} height={c.h}
                    style={{ fill: "none", stroke: BLUE, strokeOpacity: 0.4, strokeWidth: 1 }}
                    vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 dark:text-slate-500">
            Enter dimensions to preview
          </div>
        )}

        <EdgePill label="Head" on={active.edges.top} className="left-1/2 top-2 -translate-x-1/2"
          onClick={() => onEdgeToggle("top")} />
        <EdgePill label="Base" on={active.edges.bottom} className="left-1/2 bottom-11 -translate-x-1/2"
          onClick={() => onEdgeToggle("bottom")} />
        <EdgePill label="Left" on={active.edges.left} className="left-12 top-1/2 -translate-y-1/2"
          onClick={() => onEdgeToggle("left")} />
        <EdgePill label="Right" on={active.edges.right} className="right-2 top-1/2 -translate-y-1/2"
          onClick={() => onEdgeToggle("right")} />

        <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center justify-center" style={{ width: 38 }}>
          <div className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-center shadow-sm" style={{ transform: "rotate(-90deg)" }}>
            <input
              value={toDisp(primaryHeightValue)}
              onChange={e => updDim(active.profile === "standard" ? "height" : "leftH", e.target.value)}
              inputMode="decimal"
              className="w-16 bg-transparent text-center text-xs font-bold outline-none"
              style={{ color: NAVY }}
            />
            <span className="ml-1 text-[10px] font-bold" style={{ color: MUTED }}>{dimUnit}</span>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 shadow-sm">
            <input
              value={toDisp(active.width)}
              onChange={e => updDim("width", e.target.value)}
              inputMode="decimal"
              className="w-16 bg-transparent text-center text-xs font-bold outline-none"
              style={{ color: NAVY }}
            />
            <span className="text-[10px] font-bold" style={{ color: MUTED }}>{dimUnit}</span>
          </div>
        </div>
      </div>

      {active.profile === "rake" && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Num label="Right height" value={toDisp(active.rightH)} onChange={v => updDim("rightH", v)} />
        </div>
      )}
      {active.profile === "gable" && (
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Num label="Right eaves height" value={toDisp(active.rightH || active.eavesH)} onChange={v => updDim("rightH", v)} />
          <Num label="Ridge / apex height" value={toDisp(active.apexH)} onChange={v => updDim("apexH", v)} />
          <Num label="Ridge from left -- blank = centred" value={toDisp(active.ridgeX)} onChange={v => updDim("ridgeX", v)} />
        </div>
      )}
    </div>
  );
};
