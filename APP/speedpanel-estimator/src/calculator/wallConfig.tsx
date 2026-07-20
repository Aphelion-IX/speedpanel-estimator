// =============================================================================
// Wall configuration inputs (shared -- src/calculator/)
// =============================================================================
// Wall-configuration form pieces: the span table lookup display, panel
// profile selector/section, edge restraint (head/base/left/right + J/C track
// finish) selector, project-length separator, and the custom-length section.
// No dependency on WallsCard/WallsSummaryTable -- those compose this file's
// pieces at the call site, not the other way round.
//
// Formerly internalCalculator/wallConfig.tsx, forked from a shared file with
// externalCalculator's own trimmed copy. Part of the unified-estimator merge
// (see docs/unified-estimator-merge-plan.md): this file is confirmed to
// already be a strict superset of the deleted externalCalculator/wallConfig.tsx
// -- TrackFinishBlock/OtherOptionsBlock and SpanTable's Standard/Corner/Shaft
// branches are simply never invoked by a caller that doesn't pass those
// props/values, exactly how External's own copy omitted them, so moving it
// here needed zero logic changes.
// =============================================================================
import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cx, NAVY, BLUE, MUTED, selectedFill, selectableOffCx } from "../styleTokens";
import {
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ, CTRACK_DIM, MAX_H_HORIZ, MAX_W_HORIZ,
  RAKE_NOTE, SHAFT_TRACK_TABLE, CUSTOM_MAX_LENGTH,
} from "../data";
import type { Wall, ComputeOut, DimField, EdgeState } from "../estimate/wall.types";
import type { WallSystemId } from "../App";
import { Num, ToggleSwitch, ProjectLockNote } from "../ui/primitives";
import { Table, type TableColumn } from "../ui/table";
import { makeToM } from "../estimate/computeUtils";
import { validateWall } from "../estimate/validateWall";

// --- SpanTable ----------------------------------------------------------------
export const SpanTable = ({ orient, type, wallSystem }: { orient: string; type: number; wallSystem?: WallSystemId }) => {
  const [open, setOpen] = useState(false);
  const label = orient === "vertical" ? `Span table - P${type}` : `C-track span table - P${type}`;

  if (orient === "vertical") {
    const rows = SPAN_TABLE_VERT.filter(r => r.type === `P${type}`);
    const columns: TableColumn<typeof rows[number]>[] = [
      { key: "type", header: "Panel", cell: r => <span className="font-semibold" style={{ color: BLUE }}>{r.type}</span> },
      { key: "maxW", header: "Max W", cell: r => r.maxW },
      { key: "maxH", header: "Max H", cell: r => r.maxH },
    ];
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <Table columns={columns} rows={rows} rowKey={(_r, i) => i} className="rounded-none border-0 border-t" rowClassName={() => "bg-blue-50/60 dark:bg-blue-900/55"} />
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-400">Height limits apply without steel structure.</div>
          </>
        )}
      </div>
    );
  }

  // "Standard wall" and "Corner wall" (see estimate_single_wall.md and
  // estimate_free_corner_wall.md) both use one fixed C-track section for their
  // own run-level track, regardless of width/height -- no span-table lookup
  // (matches computeHorizCtrack). Show that single section here instead of the
  // generic multi-row span table, so the reference info matches what's
  // actually being ordered. (Corner wall's post has its own separate table,
  // shown inline in the corner-kit card once linked, not here.)
  if (wallSystem === "standard" || wallSystem === "corner") {
    const rows = [{ maxW: `${MAX_W_HORIZ} m`, maxH: `${MAX_H_HORIZ[type]} m`, cTrack: CTRACK_DIM[type], fix: "1/face" }];
    const columns: TableColumn<typeof rows[number]>[] = [
      { key: "maxW", header: "Max W", cell: r => <span className="font-semibold" style={{ color: NAVY }}>{r.maxW}</span> },
      { key: "maxH", header: "Max H", cell: r => r.maxH },
      { key: "cTrack", header: "C-track", cell: r => <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cTrack}</span> },
      { key: "fix", header: "Fix", cell: r => r.fix },
    ];
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <Table columns={columns} rows={rows} rowKey={(_r, i) => i} className="rounded-none border-0 border-t" />
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-400">
              {wallSystem === "standard"
                ? "Standard wall: fixed C-track section, no span-table lookup. All four edges restrained."
                : "Corner wall: fixed C-track section on the supported side. The free-corner post has its own size table -- see the corner kit once linked."}
            </div>
          </>
        )}
      </div>
    );
  }

  // "Shaft wall" (see estimate_shaft_wall.md): vertical track is sized by
  // floor height F alone, not width/height -- an entirely different table
  // shape (SHAFT_TRACK_TABLE) than the generic span table below. Shown here
  // as reference; the actual selection (driven by the wall's own floor
  // height) appears in the Vertical track card once floor height is entered.
  if (wallSystem === "shaft") {
    const columns: TableColumn<typeof SHAFT_TRACK_TABLE[number]>[] = [
      { key: "maxF", header: "Floor height up to", cell: r => <span className="font-semibold" style={{ color: NAVY }}>{r.maxF} m</span> },
      { key: "section", header: "Vertical track", cell: r => <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.section}</span> },
      { key: "fixPerCourse", header: "Screws each side", cell: r => `${r.fixPerCourse}/course` },
    ];
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>Vertical track table - P78</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <Table columns={columns} rows={SHAFT_TRACK_TABLE} rowKey={(_r, i) => i} className="rounded-none border-0 border-t" />
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-400">Sized by floor height (slab to soffit), not total shaft height. Total height stacks to any height.</div>
          </>
        )}
      </div>
    );
  }

  const rows = SPAN_TABLE_HORIZ[type] || SPAN_TABLE_HORIZ[78];
  const columns: TableColumn<typeof rows[number]>[] = [
    { key: "maxW", header: "Max W", cell: r => <span className="font-semibold" style={{ color: NAVY }}>{r.maxW}</span> },
    { key: "maxH", header: "Max H", cell: r => r.maxH },
    { key: "cTrack", header: "C-track", cell: r => <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cTrack}</span> },
    { key: "fix", header: "Fix", cell: r => r.fix },
  ];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <Table columns={columns} rows={rows} rowKey={(_r, i) => i} className="rounded-none border-0 border-t" rowClassName={r => (r.note ? "bg-amber-50/60 dark:bg-amber-900/35" : undefined)} />
          {type === 78 && <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-400">Stacked/shaft condition (W 4.5-5.0 m): height unlimited for material estimating only.</div>}
        </>
      )}
    </div>
  );
};

// --- ProfileSelector ----------------------------------------------------------
// The mockup's own `.profile-grid`/`.profile`/`.shape` markup (a small
// clip-path swatch per profile -- flat rectangle for Standard, a raked
// polygon for Rake, a gable polygon for Gable).
const ProfileSelector = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="profile-grid">
    {([ ["standard","Standard"], ["rake","Raked"], ["gable","Gable"] ] as [ProfileId, string][]).map(([id, lbl]) => (
      <button key={id} type="button" className={`profile${value === id ? " active" : ""}`} onClick={() => onChange(id)}>
        <div className={`shape${id !== "standard" ? ` ${id}` : ""}`} />{lbl}
      </button>
    ))}
  </div>
);
// --- EdgeRestraintSelector ----------------------------------------------------
export type FinishKey = "headFinish" | "bottomFinish" | "leftFinish" | "rightFinish";
export type CornersField = "intCorners" | "extCorners";
export type ActiveFinishes = Record<FinishKey, string>;
export type EdgeOption = { key: string; label: string; sublabel?: string; value: boolean; onToggle: () => void };
export type CornersValue = { intCorners: string; extCorners: string; onChange: (field: CornersField, val: string) => void };

export interface EdgeRestraintProps {
  edges: EdgeState;
  onEdgeToggle: (k: keyof EdgeState) => void;
  options?: EdgeOption[];
  orient: string;
  activeFinishes?: ActiveFinishes;
  onFinishChange?: (field: FinishKey, val: string) => void;
  corners?: CornersValue;
  locked?: boolean; // Standard wall: all 4 edges restrained is fixed by the spec, not user-editable
}

// --- RestrainedEdgesBlock ------------------------------------------------------
// Mockup's own `.edge-grid`/`.edge` markup (speedpanel-estimator-web-v5.html),
// ported into ui/estimatorTheme.css.
const RestrainedEdgesBlock = ({ edges, onEdgeToggle, locked }: {
  edges: EdgeState; onEdgeToggle: (k: keyof EdgeState) => void; locked: boolean;
}) => (
  <div>
    <div className="label">Restrained edges</div>
    <div className="edge-grid">
      {([["top", "Head"], ["bottom", "Base"], ["left", "Left"], ["right", "Right"]] as [keyof EdgeState, string][]).map(([key, label]) => {
        const on = locked || edges[key];
        return (
          <button key={key} type="button" className={`edge${on ? " active" : ""}`} disabled={locked}
            onClick={locked ? undefined : () => onEdgeToggle(key)}>
            {label}
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

// --- TrackFinishBlock -----------------------------------------------------------
// Mockup's own always-visible `.finish-grid` of C-track/J-track <select>s --
// no accordion (this used to be gated behind an "Advanced track selection"
// toggle; the mockup shows it unconditionally alongside the edge grid).
export const TrackFinishBlock = ({ edges, orient, activeFinishes, onFinishChange }: {
  edges: EdgeState; orient: string; activeFinishes?: ActiveFinishes; onFinishChange?: (field: FinishKey, val: string) => void;
}) => {
  const fields = ([
    edges.top    ? { field: "headFinish"   as FinishKey, label: "Head" }   : null,
    edges.bottom ? { field: "bottomFinish" as FinishKey, label: "Base" }   : null,
    edges.left   && orient === "vertical" ? { field: "leftFinish"  as FinishKey, label: "Left" }  : null,
    edges.right  && orient === "vertical" ? { field: "rightFinish" as FinishKey, label: "Right" } : null,
  ]).filter((x): x is { field: FinishKey; label: string } => x !== null);

  if (fields.length === 0) return null;

  return (
    <div className="finish-grid">
      {fields.map(({ field, label }) => (
        <div key={field}>
          <label className="label">{label}</label>
          <select className="select" value={activeFinishes ? activeFinishes[field] : "C"}
            onChange={e => onFinishChange && onFinishChange(field, e.target.value)}>
            <option value="C">C Track</option>
            <option value="J">J Track</option>
          </select>
        </div>
      ))}
    </div>
  );
};

// --- HeadFlashingToggle -----------------------------------------------------------
// Mockup's own `.check-row` checkbox (speedpanel-estimator-web-v5.html) --
// used to be a toggle switch.
export const HeadFlashingToggle = ({ flashOption }: { flashOption: EdgeOption }) => (
  <label className="check-row">
    <input type="checkbox" checked={flashOption.value} onChange={flashOption.onToggle} />
    Include head flashing
  </label>
);

// --- OtherOptionsBlock -----------------------------------------------------------
export const OtherOptionsBlock = ({ options }: { options: EdgeOption[] }) => (
  <div className="space-y-2">
    {options.map(({ key, label, sublabel, value, onToggle }) => (
      <button key={key} onClick={onToggle}
        className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (value ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 ${selectableOffCx}`)}
        style={value ? { ...selectedFill, color: "#fff" } : undefined}>
        {value ? "✓ " : ""}{label}
        {sublabel && <span className={`text-sm font-normal ${value ? "text-white/70" : "text-slate-400 dark:text-slate-400"}`}> {sublabel}</span>}
      </button>
    ))}
  </div>
);

// --- CornerAnglesBlock -----------------------------------------------------------
export const CornerAnglesBlock = ({ corners }: { corners: CornersValue }) => (
  <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
    <div className={cx.cardHd}>Corner angles</div>
    <div className="grid grid-cols-2 items-end gap-2">
      <div>
        <div>
          <label className={cx.lbl}>Internal</label>
          <input type="number" inputMode="decimal" value={corners.intCorners}
            onChange={e => corners.onChange("intCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
        </div>
      </div>
      <div>
        <div>
          <label className={cx.lbl}>External</label>
          <input type="number" inputMode="decimal" value={corners.extCorners}
            onChange={e => corners.onChange("extCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
        </div>
      </div>
    </div>
  </div>
);

export const EdgeRestraintSelector = ({
  edges, onEdgeToggle, options = [], orient,
  activeFinishes, onFinishChange,
  corners = { intCorners: "", extCorners: "", onChange: () => {} },
  locked = false,
}: EdgeRestraintProps) => {
  const flashOption = options.find(o => o.key === "headFlash");
  const otherOptions = options.filter(o => o.key !== "headFlash");

  // No wrapping cx.section here -- the sole caller (Calculator.tsx's
  // tracksContent) always renders this inside a CollapsibleSection, whose
  // own body wrapper now supplies that padding/spacing/card shell.
  return (
    <>
      <RestrainedEdgesBlock edges={edges} onEdgeToggle={onEdgeToggle} locked={locked} />

      {activeFinishes && onFinishChange && (
        <div className="mt-3">
          <TrackFinishBlock edges={edges} orient={orient} activeFinishes={activeFinishes} onFinishChange={onFinishChange} />
        </div>
      )}

      {flashOption && <div className="mt-3"><HeadFlashingToggle flashOption={flashOption} /></div>}

      {otherOptions.length > 0 && <OtherOptionsBlock options={otherOptions} />}

      <CornerAnglesBlock corners={corners} />
    </>
  );
};
// --- Shared layout components -------------------------------------------------

/** Decorative "Project quantities" section divider. */
export const ProjectSeparator = () => (
  <div className="mt-4 mb-2 flex items-center gap-2">
    <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/50" />
    <span className={cx.pill} style={{ background: BLUE }}>Project quantities</span>
    <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/50" />
  </div>
);
export interface CustomLengthSectionProps {
  dimUnit: string;
  customLengthInput: string;
  customActive: boolean;
  projectLock: boolean;
  projectStock: string;
  wallCount: number;
  commitCustomLength: (raw: string) => void;
  toggleCustom: () => void;
}

/** Custom-length input + toggle. */
export const CustomLengthSection = ({ dimUnit, customLengthInput, customActive, projectLock, projectStock, wallCount, commitCustomLength, toggleCustom }: CustomLengthSectionProps) => {
  const parsedM = makeToM(dimUnit)(customLengthInput);
  const numM = parseFloat(parsedM);
  const overMax = numM > CUSTOM_MAX_LENGTH + 1e-9;
  return (
    <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Custom length</label>
        <ToggleSwitch active={customActive} label={customActive ? "Active" : "Off"} onToggle={toggleCustom} />
      </div>
      <input
        type="number" inputMode="decimal"
        placeholder={dimUnit === "mm" ? "e.g. 7200" : "e.g. 7.2"}
        value={customLengthInput}
        onChange={e => commitCustomLength(e.target.value)}
        className={`${cx.input} font-medium`}
        style={{
          color: NAVY,
          borderColor: overMax ? "#f59e0b" : customActive ? BLUE : undefined,
          boxShadow: customActive && !overMax ? `0 0 0 3px color-mix(in srgb, ${BLUE} 18%, transparent)` : undefined,
          opacity: customActive ? 1 : 0.5,
        }} />
      {overMax && customActive && (
        <p className="mt-1.5 flex gap-1 text-sm leading-relaxed text-amber-700 dark:text-amber-300">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Exceeds {CUSTOM_MAX_LENGTH} m maximum -- contact Speedpanel.
        </p>
      )}
      {customActive && numM > 0 && !overMax && projectLock && (
        <ProjectLockNote wallCount={wallCount} stock={projectStock} dimUnit={dimUnit} numM={numM} customActive />
      )}
    </div>
  );
};
// --- ProfileSection -------------------------------------------------------------
// Profile selector (Standard/Raked/Gable) plus its contextual info note.
// Renders without its own card wrapper -- callers nest this inside the same
// cx.section card as the Dimensions block that follows it. Only the change
// callback differs per call site.
export type ProfileId = "standard" | "rake" | "gable";
export const ProfileSection = ({ profile, onChange }: { profile: ProfileId; onChange: (id: ProfileId) => void }) => (
  <>
    <div className={cx.cardHd}>Profile</div>
    <ProfileSelector value={profile} onChange={onChange} />
    {profile === "rake" && (
      <p className={cx.infoNote}>
        <span className="mt-0.5 shrink-0">i</span>
        {RAKE_NOTE}
      </p>
    )}
  </>
);

// --- DimensionInputs ----------------------------------------------------------
export interface DimensionInputsProps {
  active: Wall; toDisp: (m: string) => string;
  updDim: (field: DimField, d: string) => void;
  out: ComputeOut; orient: string;
  // Full wall list, for validateWall's orphaned-link/partner checks -- only
  // the active wall's OWN field errors are surfaced here, so passing the
  // rest of the project through is enough context, no per-wall prop drilling.
  walls?: Wall[];
}
export const DimensionInputs = ({ active, toDisp, updDim, out, orient, walls }: DimensionInputsProps) => {
  const isShaft = orient === "horizontal" && active.wallSystem === "shaft";
  // Only shown once the wall has actually been touched -- an untouched
  // (Not Started) wall shouldn't greet the user with a wall of red borders
  // before they've entered anything (see validateWall's own `touched` gate).
  const issues = validateWall(active, walls ?? [active], out).issues;
  const issueFor = (field: string) => issues.find(i => i.field === field)?.message;
  return (
    <>
      <div className="grid grid-cols-2 items-end gap-2">
        <Num label="Width"  value={toDisp(active.width)}  onChange={v => updDim("width", v)} error={issueFor("width")} />
        {active.profile === "standard" && !isShaft && <Num label="Height" value={toDisp(active.height)} onChange={v => updDim("height", v)} error={issueFor("height")} />}
        {active.profile === "standard" && isShaft && (
          <>
            <Num label="Total shaft height" value={toDisp(active.height)} onChange={v => updDim("height", v)} error={issueFor("height")} />
            <Num label="Floor height (slab to soffit)" value={toDisp(active.floorHeight || "")} onChange={v => updDim("floorHeight", v)} error={issueFor("floorHeight")} />
          </>
        )}
        {active.profile === "rake" && (
          <>
            <Num label="Left height"  value={toDisp(active.leftH)}  onChange={v => updDim("leftH", v)} error={issueFor("leftH")} />
            <Num label="Right height" value={toDisp(active.rightH)} onChange={v => updDim("rightH", v)} error={issueFor("rightH")} />
          </>
        )}
        {active.profile === "gable" && (
          <>
            <Num label="Left eaves height"  value={toDisp(active.leftH || active.eavesH)}  onChange={v => updDim("leftH", v)} error={issueFor("leftH")} />
            <Num label="Right eaves height" value={toDisp(active.rightH || active.eavesH)} onChange={v => updDim("rightH", v)} error={issueFor("rightH")} />
            <Num label="Ridge / apex height" value={toDisp(active.apexH)} onChange={v => updDim("apexH", v)} error={issueFor("apexH")} />
            <Num label="Ridge from left -- blank = centred" value={toDisp(active.ridgeX)} onChange={v => updDim("ridgeX", v)} error={issueFor("ridgeX")} />
          </>
        )}
      </div>
      {isShaft && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
          Shaft wall stacks continuously -- total height drives panel/screw counts; floor height sizes the vertical track (see estimate_shaft_wall.md).
        </p>
      )}
      {!out.empty && (out.maxH || 0) > 6.1 && orient === "vertical" && (
        <p className={cx.infoNote}>
          <span className="mt-0.5 shrink-0">i</span>
          Panels greater than 6.0 m are heavier and harder to handle on site. Speak to Speedpanel about installing a nib.
        </p>
      )}
    </>
  );
};
