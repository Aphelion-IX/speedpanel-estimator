// =============================================================================
// Phone sections (External Calculator only)
// =============================================================================
// Phone-only rebuild of the "System configuration" / "Wall geometry" /
// "Panel length & optimisation" / "Tracks, flashing & restraint" sections,
// mirroring internalCalculator/phoneSections.tsx's visual language:
//   - .seg  (grey track, WHITE-pill + blue text when selected)   -> SegPhone
//   - .edge (light blue tint when selected, not solid fill)      -> EdgeGridPhone
//   - one continuous "sheet" card with thin dividers between
//     groups, instead of separate floating cards                -> SheetCardPhone/SheetSectionPhone
//
// Every colour used here resolves to an existing styleTokens.ts token
// (BLUE/NAVY/MUTED, tone(), or the exact blue-tint classes cx.infoBox/
// cx.accordionInner already use) -- no new hex values or hand-rolled
// Tailwind colour classes, and no yellow/gold anywhere.
//
// SegPhone/EdgeGridPhone/SheetCardPhone/SheetSectionPhone/WarningsListPhone
// below are deliberately External's OWN copies, not imported from
// internalCalculator/phoneSections.tsx -- fully self-contained per
// calculator, same reasoning as the wallsCard/wallConfig/lengthExplorer
// fork. SystemConfigSectionPhone/GeometrySectionPhone/PanelLengthSectionPhone/
// TracksFlashingSectionPhone reuse External's own leaves directly
// (PanelColourSection, JunctionLinkSelector, WallNameAndActions,
// DimensionInputs, WallPreviewSection, SpanTable, PanelLengthSection,
// HeadFlashingToggle, CornerAnglesBlock) -- no wall-system/panel-type/
// corner-shaft pieces at all, External has none of those.
// =============================================================================
import { Frame, Lock, Ruler, Settings } from "lucide-react";
import { cx, tone, BLUE, NAVY, MUTED } from "../styleTokens";
import { RAKE_NOTE } from "../data";
import type { Wall, ComputeOut, DimField, EdgeState } from "../estimate/wall.types";
import { UnitToggle } from "../ui/primitives";
import { JunctionLinkSelector, WallNameAndActions } from "./wallsCard";
import {
  DimensionInputs, SpanTable, HeadFlashingToggle, CornerAnglesBlock,
  type ProfileId, type CornersField, type EdgeOption,
} from "./wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelLengthSection, type PanelLengthSectionProps } from "./lengthExplorer";
import { PanelColourSection } from "./panelColourSection";

// --- SegPhone -------------------------------------------------------------
// The mockup's ".seg" pattern: grey track, unselected = transparent/navy
// text, selected = white pill + blue text (NOT a solid blue fill -- that's
// the app's existing button-grid style, and also the mockup's DIFFERENT
// ".unit-toggle" pattern already matched by ui/primitives.tsx's UnitToggle).
// Track uses a literal "bg-slate-100 dark:bg-slate-900" (one step darker
// than the dark:bg-slate-800 card it sits in, mirroring how light mode's
// slate-100 track already reads as recessed against the white card) rather
// than tone("neutral") -- that helper's text-color half is dead code here
// anyway, always overridden by the inline style={{ color }} below. Selected
// pill stays the same "bg-white dark:bg-slate-800" card-fill pattern
// cx.section/IconButton/item pills already use -- now visibly lighter than
// the track in dark mode too.
export function SegPhone<T extends string>({ options, value, onChange, columns }: {
  options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; columns?: number;
}) {
  return (
    <div className="grid gap-1 rounded-[10px] p-1 bg-slate-100 dark:bg-slate-900" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, 1fr)` }}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className={`min-h-[44px] rounded-lg text-xs font-extrabold uppercase tracking-wide transition-all active:scale-95 ${on ? "bg-white dark:bg-slate-800 shadow-sm" : ""}`}
            style={{ color: on ? BLUE : NAVY }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// --- EdgeGridPhone ----------------------------------------------------------
// The mockup's ".edge" pattern: white/bordered when off, light BLUE TINT
// (not solid fill) when on.
const EDGE_ITEMS: { key: keyof EdgeState; label: string }[] = [
  { key: "top", label: "Head" }, { key: "bottom", label: "Base" },
  { key: "left", label: "Left" }, { key: "right", label: "Right" },
];
export const EdgeGridPhone = ({ edges, onEdgeToggle }: {
  edges: EdgeState; onEdgeToggle: (k: keyof EdgeState) => void;
}) => (
  <div>
    <div className={cx.cardHd}>Restrained edges</div>
    <div className="grid grid-cols-2 gap-2">
      {EDGE_ITEMS.map(({ key, label }) => {
        const on = edges[key];
        return (
          <button key={key} type="button" onClick={() => onEdgeToggle(key)}
            className={`min-h-[44px] rounded-lg border text-sm font-semibold transition-all active:scale-95 ${on ? "border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}
            style={{ color: on ? BLUE : NAVY }}>
            {on ? "✓ " : ""}{label}
          </button>
        );
      })}
    </div>
  </div>
);

// --- WarningsListPhone -------------------------------------------------------
// Red, not the shared WarningsList's amber cx.warnbox.
export const WarningsListPhone = ({ warnings, emptyLabel = "No active warnings for this wall." }: {
  warnings?: string[] | null; emptyLabel?: string;
}) => {
  if (!warnings || warnings.length === 0) {
    return <p className="text-sm" style={{ color: MUTED }}>{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {warnings.map((w, i) => (
        <div key={i} className={`flex gap-2.5 rounded-xl border border-red-200 dark:border-red-800/60 p-3.5 text-sm leading-relaxed ${tone("danger")}`}>
          <span className="mt-0.5 shrink-0">!</span>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
};

// --- Sheet card / section --------------------------------------------------
export const SheetCardPhone = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_20px_40px_-24px_rgba(0,0,0,0.35)]">
    {children}
  </div>
);

export const SheetSectionPhone = ({ icon, label, children }: {
  icon?: React.ReactNode; label?: string; children: React.ReactNode;
}) => (
  <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-4">
    {label && (
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
        {icon && <span style={{ color: BLUE }}>{icon}</span>}{label}
      </div>
    )}
    {children}
  </div>
);

// --- System configuration ---------------------------------------------------
// Replaces WallsCard entirely on External phone (does not call it). No
// panel-type/wall-system/corner-shaft pieces -- External has none of those,
// P78 is the only panel and there's no wallSystem concept. Panel
// configuration here is the colour swatch picker (PanelColourSection),
// reused completely as-is (not forked/recoloured -- see phoneSections.tsx's
// header comment and the plan's "left alone" note on its gold Custom badge).
export const SystemConfigSectionPhone = ({
  walls, active, update, duplicateWall, deleteWall, orient,
  onJunctionLink, switchOrient, switchToInternal,
}: {
  walls: Wall[]; active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void; orient: "vertical" | "horizontal";
  onJunctionLink: (targetId: number | null) => void;
  switchOrient: (o: "vertical" | "horizontal") => void;
  switchToInternal: () => void;
}) => (
  <SheetSectionPhone icon={<Settings size={13} />} label="System configuration">
    <div className={cx.cardHd}>Orientation</div>
    <SegPhone
      options={[{ id: "vertical" as const, label: "Vertical" }, { id: "horizontal" as const, label: "Horizontal" }]}
      value={orient} onChange={switchOrient}
    />

    <div className="mt-3">
      <div className={cx.cardHd}>Wall type</div>
      <SegPhone
        options={[{ id: "internal" as const, label: "Internal" }, { id: "external" as const, label: "External" }]}
        value="external" onChange={id => { if (id === "internal") switchToInternal(); }}
      />
    </div>

    <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
      <PanelColourSection active={active} update={update} />
    </div>

    {walls.length > 1 && (
      <div className="mt-3"><JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} /></div>
    )}

    <div className="mt-3">
      <WallNameAndActions walls={walls} active={active} update={update} duplicateWall={duplicateWall} deleteWall={deleteWall} />
    </div>
  </SheetSectionPhone>
);

// --- Wall geometry -----------------------------------------------------------
export const GeometrySectionPhone = ({
  active, update, toDisp, updDim, out, orient, walls, dimUnit, switchDimUnit, project,
}: {
  active: Wall; update: (patch: Partial<Wall>) => void;
  toDisp: (m: string) => string; updDim: (field: DimField, d: string) => void;
  out: ComputeOut; orient: "vertical" | "horizontal"; walls: Wall[];
  dimUnit: string; switchDimUnit: (u: string) => void;
  // Preview is pulled out into WallWorkspaceTabs's own Preview tab in
  // single-wall mode on phone -- only shown inline here in project mode,
  // same gate Internal's uses (this component only ever renders on phone).
  project: boolean;
}) => (
  <SheetSectionPhone icon={<Frame size={13} />} label="Wall geometry">
    <div className={cx.cardHd}>Profile</div>
    <SegPhone
      columns={3}
      options={[{ id: "standard" as ProfileId, label: "Standard" }, { id: "rake" as ProfileId, label: "Raked" }, { id: "gable" as ProfileId, label: "Gable" }]}
      value={active.profile} onChange={id => update({ profile: id })}
    />
    {active.profile === "rake" && (
      <p className={cx.infoNote}><span className="mt-0.5 shrink-0">i</span>{RAKE_NOTE}</p>
    )}

    <div className="mt-4 flex items-center justify-between">
      <span className={cx.cardHd} style={{ marginBottom: 0 }}>Dimensions</span>
      <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
    </div>
    <div className="mt-2">
      <DimensionInputs active={active} toDisp={toDisp} updDim={updDim} out={out} orient={orient} />
    </div>

    {project && <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />}

    <div className="mt-3"><SpanTable orient={orient} type={78} /></div>
  </SheetSectionPhone>
);

// --- Panel length & optimisation ---------------------------------------------
export const PanelLengthSectionPhone = (props: PanelLengthSectionProps) => (
  <SheetSectionPhone icon={<Ruler size={13} />} label="Panel length & optimisation">
    <PanelLengthSection {...props} />
  </SheetSectionPhone>
);

// --- Tracks, flashing & restraint ---------------------------------------------
// No TrackFinishBlock ("Advanced track selection") -- External's own
// wallConfig.tsx fork doesn't have one (its EdgeRestraintSelector call never
// used it). No `locked` edges either -- External's original EdgeRestraintSelector
// call never passed one, so all four edges are always freely toggleable.
export const TracksFlashingSectionPhone = ({ active, update }: {
  active: Wall; update: (patch: Partial<Wall>) => void;
}) => {
  const flashOption: EdgeOption = {
    key: "headFlash",
    label: "Head track flashing",
    value: active.headFlash,
    onToggle: () => update({ headFlash: !active.headFlash }),
  };
  return (
    <SheetSectionPhone icon={<Lock size={13} />} label="Tracks, flashing & restraint">
      <EdgeGridPhone
        edges={active.edges}
        onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
      />
      <div className="mt-3"><HeadFlashingToggle flashOption={flashOption} /></div>
      <div className="mt-3">
        <CornerAnglesBlock corners={{
          intCorners: active.intCorners, extCorners: active.extCorners,
          onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>),
        }} />
      </div>
    </SheetSectionPhone>
  );
};
