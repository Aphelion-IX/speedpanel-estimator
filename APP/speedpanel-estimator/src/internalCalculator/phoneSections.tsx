// =============================================================================
// Phone sections (Internal Calculator only)
// =============================================================================
// Phone-only rebuild of the "System configuration" / "Wall geometry" /
// "Panel length & optimisation" / "Tracks, flashing & restraint" sections,
// matching the approved mockup's actual visual language instead of reusing
// the app's generic desktop button-grid style:
//   - .seg  (grey track, WHITE-pill + blue text when selected)   -> SegPhone
//   - .edge (light blue tint when selected, not solid fill)      -> EdgeGridPhone
//   - one continuous "sheet" card with thin dividers between
//     groups, instead of separate floating cards                -> SheetCardPhone/SheetSectionPhone
//
// Every colour used here resolves to an existing styleTokens.ts token
// (BLUE/NAVY/MUTED, tone(), or the exact blue-tint classes cx.infoBox/
// cx.accordionInner already use) -- no new hex values or hand-rolled
// Tailwind colour classes, and no yellow/gold anywhere (see AI_HANDOFF_
// PROMPT.md's colour rule).
//
// Deliberately forked from the shared WallsCard/SystemRows/ProfileSelector/
// EdgeRestraintSelector (rather than adding a layoutMode branch inside them)
// -- those are shared with ExternalCalculator too, and a layoutMode branch
// inside them would leak this Internal-only restyle into External's phone
// view, which must stay untouched. Same fork-not-branch precedent as
// phoneShell.tsx/kitWorkspacePhone.tsx. Reuses the underlying store actions
// (update/switchOrient/switchToExternal) and small presentational leaves
// (PanelTypeSelector, WALL_SYSTEMS, CornerLinkSelector, ShaftLinkSelector,
// JunctionLinkSelector, WallNameAndActions, DimensionInputs, WallPreviewSection,
// SpanTable, PanelLengthSection, TrackFinishBlock, HeadFlashingToggle,
// CornerAnglesBlock) directly -- only the selector chrome around them is new.
// =============================================================================
import { useState } from "react";
import { Frame, Lock, Ruler, Settings } from "lucide-react";
import { cx, tone, BLUE, NAVY, MUTED } from "../styleTokens";
import { RAKE_NOTE } from "../data";
import type { Wall, ComputeOut, DimField, EdgeState } from "../estimate/wall.types";
import type { WallSystemId } from "../App";
import { UnitToggle } from "../ui/primitives";
import { WALL_SYSTEMS, PanelTypeSelector, CornerLinkSelector, ShaftLinkSelector, JunctionLinkSelector, WallNameAndActions } from "../calculator/wallsCard";
import {
  DimensionInputs, SpanTable, TrackFinishBlock, HeadFlashingToggle, CornerAnglesBlock,
  type ProfileId, type FinishKey, type CornersField, type EdgeOption,
} from "../calculator/wallConfig";
import { WallPreviewSection } from "../ui/wallPreview";
import { PanelLengthSection, type PanelLengthSectionProps } from "./lengthExplorer";

// --- SegPhone -------------------------------------------------------------
// The mockup's ".seg" pattern: grey track, unselected = transparent/navy
// text, selected = white pill + blue text (NOT a solid blue fill -- that's
// the app's existing button-grid style, and also the mockup's DIFFERENT
// ".unit-toggle" pattern already matched by ui/primitives.tsx's UnitToggle).
// Track background is a literal bg-slate-100/900, not tone("neutral")
// (dark:bg-slate-800) -- every phone card is itself dark:bg-slate-800, so
// that shade is invisible as a track here; dark:bg-slate-900 keeps it one
// step darker/recessed, same relationship light mode already has (slate-100
// track vs white card). Selected pill reuses the same "bg-white
// dark:bg-slate-800" card-fill pattern cx.section/IconButton/item pills
// already use -- now visibly lighter than the slate-900 track beneath it.
//
// The pill is one shared absolutely-positioned div that slides between slots
// (translateX in multiples of its own width, so no gap-vs-percentage math is
// needed) rather than each button toggling its own background -- flex, not
// grid, so every slot is an equal fraction of the track with no gaps to
// account for (unselected buttons are transparent anyway, so removing the
// old gap-1 between them is visually identical).
export function SegPhone<T extends string>({ options, value, onChange, columns }: {
  options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; columns?: number;
}) {
  const cols = columns ?? options.length;
  const activeIndex = Math.max(0, options.findIndex(o => o.id === value));
  return (
    <div className="relative flex rounded-[10px] p-1 bg-slate-100 dark:bg-slate-900">
      <div
        className="absolute inset-y-1 rounded-lg bg-white dark:bg-slate-800 shadow-sm transition-transform duration-200 ease-out"
        style={{ width: `${100 / cols}%`, transform: `translateX(${activeIndex * 100}%)` }}
      />
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            className="relative z-10 min-h-[44px] flex-1 rounded-lg text-xs font-extrabold uppercase tracking-wide transition-colors active:scale-95"
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
// (not solid fill) when on -- a third, distinct pattern from SegPhone/
// UnitToggle. Reuses the exact blue-tint classes cx.infoBox/cx.accordionInner
// already use elsewhere, rather than inventing a new colour.
const EDGE_ITEMS: { key: keyof EdgeState; label: string }[] = [
  { key: "top", label: "Head" }, { key: "bottom", label: "Base" },
  { key: "left", label: "Left" }, { key: "right", label: "Right" },
];
export const EdgeGridPhone = ({ edges, onEdgeToggle, locked }: {
  edges: EdgeState; onEdgeToggle: (k: keyof EdgeState) => void; locked?: boolean;
}) => (
  <div>
    <div className={cx.cardHd}>Restrained edges</div>
    <div className="grid grid-cols-2 gap-2">
      {EDGE_ITEMS.map(({ key, label }) => {
        const on = locked || edges[key];
        return (
          <button key={key} type="button" disabled={locked} onClick={locked ? undefined : () => onEdgeToggle(key)}
            className={`min-h-[44px] rounded-lg border text-sm font-semibold transition-all ${locked ? "cursor-default" : "active:scale-95"} ${on ? "border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800"}`}
            style={{ color: on ? BLUE : NAVY }}>
            {on ? "✓ " : ""}{label}
          </button>
        );
      })}
    </div>
    {locked && (
      <p className="mt-2 text-xs leading-relaxed" style={{ color: MUTED }}>
        Standard wall assumes all four edges restrained (slab, soffit, and structure both sides).
      </p>
    )}
  </div>
);

// --- WarningsListPhone -------------------------------------------------------
// Red, not the shared WarningsList's amber cx.warnbox -- "Red: warnings and
// errors" per the mockup's visual rules. Same border-weight convention as
// cx.warnbox, just tone("danger") instead of amber.
export const WarningsListPhone = ({ warnings, emptyLabel = "No active warnings for this wall." }: {
  warnings?: string[] | null; emptyLabel?: string;
}) => {
  if (!warnings || warnings.length === 0) {
    return <p className="text-sm" style={{ color: MUTED }}>{emptyLabel}</p>;
  }
  return (
    <div className="space-y-2.5">
      {warnings.map((w, i) => (
        <div key={i} className={`flex gap-2.5 rounded-xl border border-red-200 dark:border-red-700/80 p-3.5 text-sm leading-relaxed ${tone("danger")}`}>
          <span className="mt-0.5 shrink-0">!</span>
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
};

// --- Sheet card / section --------------------------------------------------
// One continuous card (SheetCardPhone) with flush, divider-separated
// sections (SheetSectionPhone) inside it -- matching the mockup's single
// ".sheet" wrapping sheet-head + metrics + every config section + the tabs,
// instead of Round 1's separate floating cx.section cards with gaps.
export const SheetCardPhone = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-28px_rgba(15,23,42,0.18)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_20px_40px_-24px_rgba(0,0,0,0.35)]">
    {children}
  </div>
);

export const SheetSectionPhone = ({ icon, label, noDivider, children }: {
  icon?: React.ReactNode; label?: string; noDivider?: boolean; children: React.ReactNode;
}) => (
  <div className={noDivider ? "px-4 py-4" : "border-b border-slate-100 dark:border-slate-700 px-4 py-4"}>
    {label && (
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
        {icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-blue-50/60 dark:bg-blue-900/55" style={{ color: BLUE }}>
            {icon}
          </span>
        )}{label}
      </div>
    )}
    {children}
  </div>
);

// --- System configuration ---------------------------------------------------
// Replaces WallsCard entirely on Internal phone (does not call it) -- see
// this file's header comment for why. Orientation/Wall type reuse the same
// switchOrient/switchToExternal store wiring App.tsx already threads through
// SystemRows for web; Panel/Wall system/link selectors/name+actions reuse
// the shared leaves directly (WALL_SYSTEMS, PanelTypeSelector,
// CornerLinkSelector, ShaftLinkSelector, JunctionLinkSelector,
// WallNameAndActions) so none of that logic is duplicated.
export const SystemConfigSectionPhone = ({
  walls, active, update, duplicateWall, deleteWall, orient,
  onCornerLink, onShaftLink, onJunctionLink, switchOrient, switchToExternal,
}: {
  walls: Wall[]; active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void; orient: "vertical" | "horizontal";
  onCornerLink: (targetId: number | null) => void;
  onShaftLink: (targetId: number | null) => void;
  onJunctionLink: (targetId: number | null) => void;
  switchOrient: (o: "vertical" | "horizontal") => void;
  switchToExternal: () => void;
}) => (
  <SheetCardPhone>
  <SheetSectionPhone icon={<Settings size={13} />} label="System configuration" noDivider>
    <div className={cx.cardHd}>Panel orientation</div>
    <SegPhone
      options={[{ id: "vertical" as const, label: "Vertical" }, { id: "horizontal" as const, label: "Horizontal" }]}
      value={orient} onChange={switchOrient}
    />

    <div className="mt-3">
      <div className={cx.cardHd}>Wall location</div>
      <SegPhone
        options={[{ id: "internal" as const, label: "Internal" }, { id: "external" as const, label: "External" }]}
        value="internal" onChange={id => { if (id === "external") switchToExternal(); }}
      />
    </div>

    <div className="mt-3">
      <PanelTypeSelector active={active} update={update} topBorder={true} headingLabel="Panel type" />
    </div>

    {orient === "horizontal" && (
      <div className="mt-3">
        <div className={cx.cardHd}>Wall system</div>
        <SegPhone
          columns={3}
          options={WALL_SYSTEMS.map(([id, label]) => ({ id, label: label.replace(" wall", "") }))}
          value={active.wallSystem}
          onChange={id => update(id === "shaft" ? { wallSystem: id as WallSystemId, type: 78 } : { wallSystem: id as WallSystemId })}
        />
        {active.wallSystem === "corner" && (
          <div className="mt-3">
            <CornerLinkSelector active={active} walls={walls} onLink={onCornerLink} onSideChange={side => update({ cornerSide: side })} />
          </div>
        )}
        {active.wallSystem === "shaft" && (
          <div className="mt-3"><ShaftLinkSelector active={active} walls={walls} onLink={onShaftLink} /></div>
        )}
      </div>
    )}

    {walls.length > 1 && (
      <div className="mt-3"><JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} /></div>
    )}

    <div className="mt-3">
      <WallNameAndActions active={active} update={update} duplicateWall={duplicateWall} deleteWall={deleteWall} />
    </div>
  </SheetSectionPhone>
  </SheetCardPhone>
);

// --- Wall geometry -----------------------------------------------------------
export const GeometrySectionPhone = ({
  active, update, toDisp, updDim, out, orient, walls, dimUnit, switchDimUnit,
}: {
  active: Wall; update: (patch: Partial<Wall>) => void;
  toDisp: (m: string) => string; updDim: (field: DimField, d: string) => void;
  out: ComputeOut; orient: "vertical" | "horizontal"; walls: Wall[];
  dimUnit: string; switchDimUnit: (u: string) => void;
}) => (
  <SheetCardPhone>
  <SheetSectionPhone icon={<Frame size={13} />} label="Wall geometry" noDivider>
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
      <DimensionInputs active={active} toDisp={toDisp} updDim={updDim} out={out} orient={orient} walls={walls} />
    </div>

    <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />

    <div className="mt-3"><SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} /></div>
  </SheetSectionPhone>
  </SheetCardPhone>
);

// --- Panel length & optimisation ---------------------------------------------
export const PanelLengthSectionPhone = (props: PanelLengthSectionProps) => (
  <SheetCardPhone>
  <SheetSectionPhone icon={<Ruler size={13} />} label="Panel length & optimisation" noDivider>
    <PanelLengthSection {...props} />
  </SheetSectionPhone>
  </SheetCardPhone>
);

// --- Tracks, flashing & restraint ---------------------------------------------
export const TracksFlashingSectionPhone = ({ active, update, orient }: {
  active: Wall; update: (patch: Partial<Wall>) => void; orient: "vertical" | "horizontal";
}) => {
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  // Internal's real call site only ever passes one EdgeOption (headFlash) --
  // OtherOptionsBlock (extra toggle-button options) has nothing to render
  // for Internal today, so it's not reused here either (no behaviour lost).
  const flashOption: EdgeOption = {
    key: "headFlash",
    label: "Head track flashing",
    value: active.headFlash,
    onToggle: () => update({ headFlash: !active.headFlash }),
  };
  return (
    <SheetCardPhone>
    <SheetSectionPhone icon={<Lock size={13} />} label="Tracks, flashing & restraint" noDivider>
      <EdgeGridPhone
        edges={active.edges}
        onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
        locked={orient === "horizontal" && active.wallSystem === "standard"}
      />
      <div className="mt-3">
        <TrackFinishBlock
          edges={active.edges} orient={orient}
          activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
          onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
          showTrackFinish={showTrackFinish} setShowTrackFinish={setShowTrackFinish}
        />
      </div>
      <div className="mt-3"><HeadFlashingToggle flashOption={flashOption} /></div>
      <div className="mt-3">
        <CornerAnglesBlock corners={{
          intCorners: active.intCorners, extCorners: active.extCorners,
          onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>),
        }} />
      </div>
    </SheetSectionPhone>
    </SheetCardPhone>
  );
};
