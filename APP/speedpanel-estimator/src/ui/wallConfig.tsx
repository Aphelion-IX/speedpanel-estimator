// =============================================================================
// Wall configuration inputs
// =============================================================================
// Shared wall-configuration form pieces used by both calculators: the span
// table lookup display, panel profile selector/section, edge restraint (head/
// base/left/right + J/C track finish) selector, project-length separator, and
// the custom-length section. No dependency on WallsCard/WallsSummaryTable --
// those compose this file's pieces at the call site, not the other way round.
// =============================================================================
import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cx, NAVY, BLUE } from "../styleTokens";
import {
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ, CTRACK_DIM, MAX_H_HORIZ, MAX_W_HORIZ,
  RAKE_NOTE, SHAFT_TRACK_TABLE, CUSTOM_MAX_LENGTH,
} from "../data";
import type { Wall, ComputeOut, DimField, EdgeState } from "../estimate/wall.types";
import type { WallSystemId } from "../App";
import { Num, ToggleSwitch, ProjectLockNote } from "./primitives";
import { makeToM } from "../estimate/computeUtils";

// --- SpanTable ----------------------------------------------------------------
export const SpanTable = ({ orient, type, wallSystem }: { orient: string; type: number; wallSystem?: WallSystemId }) => {
  const [open, setOpen] = useState(false);
  const TH = "py-2.5 px-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800";
  const TD = "py-2.5 px-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0";
  const TDm = "py-2.5 px-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 last:border-0";
  const label = orient === "vertical" ? `Span table - P${type}` : `C-track span table - P${type}`;

  if (orient === "vertical") {
    const rows = SPAN_TABLE_VERT.filter(r => r.type === `P${type}`);
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Panel</th><th className={TH}>Max W</th><th className={TH}>Max H</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} className="bg-blue-50/60 dark:bg-blue-950/40">
                  <td className={TDm} style={{ color: BLUE }}>{r.type}</td>
                  <td className={TD}>{r.maxW}</td>
                  <td className={TD}>{r.maxH}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Height limits apply without steel structure.</div>
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
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
              <tbody>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{MAX_W_HORIZ} m</td>
                  <td className={TD}>{MAX_H_HORIZ[type]} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{CTRACK_DIM[type]}</td>
                  <td className={TD}>1/face</td>
                </tr>
              </tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">
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
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>Vertical track table - P78</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Floor height up to</th><th className={TH}>Vertical track</th><th className={TH}>Screws each side</th></tr></thead>
              <tbody>{SHAFT_TRACK_TABLE.map((r, i) => (
                <tr key={i}>
                  <td className={TDm} style={{ color: NAVY }}>{r.maxF} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.section}</td>
                  <td className={TD}>{r.fixPerCourse}/course</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Sized by floor height (slab to soffit), not total shaft height. Total height stacks to any height.</div>
          </>
        )}
      </div>
    );
  }

  const rows = SPAN_TABLE_HORIZ[type] || SPAN_TABLE_HORIZ[78];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <table className="w-full border-t border-slate-100 dark:border-slate-800">
            <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className={r.note ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                <td className={TDm} style={{ color: NAVY }}>{r.maxW}</td>
                <td className={TD}>{r.maxH}</td>
                <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cTrack}</td>
                <td className={TD}>{r.fix}</td>
              </tr>
            ))}</tbody>
          </table>
          {type === 78 && <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Stacked/shaft condition (W 4.5-5.0 m): height unlimited for material estimating only.</div>}
        </>
      )}
    </div>
  );
};

// --- ProfileSelector ----------------------------------------------------------
export const ProfileSelector = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    {([ ["standard","Standard"], ["rake","Raked"], ["gable","Gable"] ] as [ProfileId, string][]).map(([id, lbl]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
          style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
      );
    })}
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
  showTrackFinish?: boolean;
  setShowTrackFinish?: (fn: (v: boolean) => boolean) => void;
  activeFinishes?: ActiveFinishes;
  onFinishChange?: (field: FinishKey, val: string) => void;
  corners?: CornersValue;
  locked?: boolean; // Standard wall: all 4 edges restrained is fixed by the spec, not user-editable
}

// --- RestrainedEdgesBlock ------------------------------------------------------
const EdgeBtn = ({ edgeKey, label, edges, locked, onEdgeToggle }: {
  edgeKey: keyof EdgeState; label: string; edges: EdgeState; locked: boolean; onEdgeToggle: (k: keyof EdgeState) => void;
}) => {
  const on = locked || edges[edgeKey];
  return (
    <button onClick={locked ? undefined : () => onEdgeToggle(edgeKey)} disabled={locked}
      className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center transition-all " + (locked ? "cursor-default" : "active:scale-95") + (on ? "" : " border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
      style={on ? { borderColor: BLUE, background: BLUE, color: "#fff", opacity: locked ? 0.85 : 1 } : { color: "#94a3b8" }}>
      {on ? "✓ " : ""}{label}
    </button>
  );
};

const RestrainedEdgesBlock = ({ edges, onEdgeToggle, locked }: {
  edges: EdgeState; onEdgeToggle: (k: keyof EdgeState) => void; locked: boolean;
}) => (
  <div>
    <div className={cx.cardHd}>Restrained edges</div>
    <div className="grid grid-cols-2 items-end gap-2">
      <EdgeBtn edgeKey="top" label="Head" edges={edges} locked={locked} onEdgeToggle={onEdgeToggle} />
      <EdgeBtn edgeKey="bottom" label="Base" edges={edges} locked={locked} onEdgeToggle={onEdgeToggle} />
      <EdgeBtn edgeKey="left" label="Left" edges={edges} locked={locked} onEdgeToggle={onEdgeToggle} />
      <EdgeBtn edgeKey="right" label="Right" edges={edges} locked={locked} onEdgeToggle={onEdgeToggle} />
    </div>
    {locked && (
      <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        Standard wall assumes all four edges restrained (slab, soffit, and structure both sides).
      </p>
    )}
  </div>
);

// --- TrackFinishBlock -----------------------------------------------------------
const TrackSwitch = ({ field, label, activeFinishes, onFinishChange }: {
  field: FinishKey; label: string; activeFinishes?: ActiveFinishes; onFinishChange?: (field: FinishKey, val: string) => void;
}) => {
  const isJ = activeFinishes ? activeFinishes[field] === "J" : false;
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isJ ? "J-track" : "C-track"}</span>
        <button onClick={() => onFinishChange && onFinishChange(field, isJ ? "C" : "J")}
          style={{ background: isJ ? BLUE : "#cbd5e1", width: 44, height: 24, borderRadius: 12, position: "relative", border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 2, left: isJ ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block" }} />
        </button>
      </div>
    </div>
  );
};

const TrackFinishBlock = ({ edges, orient, activeFinishes, onFinishChange, showTrackFinish, setShowTrackFinish }: {
  edges: EdgeState; orient: string; activeFinishes?: ActiveFinishes; onFinishChange?: (field: FinishKey, val: string) => void;
  showTrackFinish: boolean; setShowTrackFinish: (fn: (v: boolean) => boolean) => void;
}) => (
  <div>
    <button onClick={() => setShowTrackFinish(v => !v)}
      className={`${cx.accordionInner} active:scale-95`}>
      <span>Advanced track selection</span>
      <ChevronDown size={13} className={`text-slate-400 dark:text-slate-500 transition-transform ${showTrackFinish ? "rotate-180" : ""}`} />
    </button>
    {showTrackFinish && (
      <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
        {(([
          edges.top    ? { field: "headFinish"   as FinishKey, label: "Head" }   : null,
          edges.bottom ? { field: "bottomFinish" as FinishKey, label: "Base" }   : null,
          edges.left   && orient === "vertical" ? { field: "leftFinish"  as FinishKey, label: "Left" }  : null,
          edges.right  && orient === "vertical" ? { field: "rightFinish" as FinishKey, label: "Right" } : null,
        ]).filter((x): x is { field: FinishKey; label: string } => x !== null)).map(({ field, label }) => (
          <TrackSwitch key={label} field={field} label={label} activeFinishes={activeFinishes} onFinishChange={onFinishChange} />
        ))}
        {!edges.top && !edges.bottom && !edges.left && !edges.right && (
          <p className="py-3 text-center text-sm text-slate-400 dark:text-slate-500">No restrained edges selected</p>
        )}
        <p className="py-2.5 text-sm text-slate-400 dark:text-slate-500">J-track available on P78 panels only</p>
      </div>
    )}
  </div>
);

// --- HeadFlashingToggle -----------------------------------------------------------
const HeadFlashingToggle = ({ flashOption }: { flashOption: EdgeOption }) => (
  <div className="flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-2">
    <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Head track flashing</span>
    <button onClick={flashOption.onToggle}
      style={{
        background: flashOption.value ? BLUE : "#cbd5e1",
        width: 44, height: 24, borderRadius: 12, position: "relative",
        border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
      }}>
      <span style={{
        position: "absolute", top: 2, left: flashOption.value ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block",
      }} />
    </button>
  </div>
);

// --- OtherOptionsBlock -----------------------------------------------------------
const OtherOptionsBlock = ({ options }: { options: EdgeOption[] }) => (
  <div className="space-y-2">
    {options.map(({ key, label, sublabel, value, onToggle }) => (
      <button key={key} onClick={onToggle}
        className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (value ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
        style={value ? { borderColor: BLUE, background: BLUE, color: "#fff" } : undefined}>
        {value ? "✓ " : ""}{label}
        {sublabel && <span className={`text-sm font-normal ${value ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}> {sublabel}</span>}
      </button>
    ))}
  </div>
);

// --- CornerAnglesBlock -----------------------------------------------------------
const CornerAnglesBlock = ({ corners }: { corners: CornersValue }) => (
  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
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
  showTrackFinish, setShowTrackFinish, activeFinishes, onFinishChange,
  corners = { intCorners: "", extCorners: "", onChange: () => {} },
  locked = false,
}: EdgeRestraintProps) => {
  const flashOption = options.find(o => o.key === "headFlash");
  const otherOptions = options.filter(o => o.key !== "headFlash");

  return (
    <div className={cx.section}>
      <RestrainedEdgesBlock edges={edges} onEdgeToggle={onEdgeToggle} locked={locked} />

      {showTrackFinish !== undefined && setShowTrackFinish && (
        <TrackFinishBlock
          edges={edges} orient={orient} activeFinishes={activeFinishes} onFinishChange={onFinishChange}
          showTrackFinish={showTrackFinish} setShowTrackFinish={setShowTrackFinish}
        />
      )}

      {flashOption && <HeadFlashingToggle flashOption={flashOption} />}

      {otherOptions.length > 0 && <OtherOptionsBlock options={otherOptions} />}

      <CornerAnglesBlock corners={corners} />
    </div>
  );
};
// --- Shared layout components -------------------------------------------------

/** Decorative "Project quantities" section divider used in both calculators. */
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

/** Custom-length input + toggle, shared between internal and external calculators. */
export const CustomLengthSection = ({ dimUnit, customLengthInput, customActive, projectLock, projectStock, wallCount, commitCustomLength, toggleCustom }: CustomLengthSectionProps) => {
  const parsedM = makeToM(dimUnit)(customLengthInput);
  const numM = parseFloat(parsedM);
  const overMax = numM > CUSTOM_MAX_LENGTH + 1e-9;
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
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
          boxShadow: customActive && !overMax ? `0 0 0 2px ${BLUE}22` : undefined,
          opacity: customActive ? 1 : 0.5,
        }} />
      {overMax && customActive && (
        <p className="mt-1.5 flex gap-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
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
// callback differs between the internal and external calculator call sites.
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
}
export const DimensionInputs = ({ active, toDisp, updDim, out, orient }: DimensionInputsProps) => {
  const isShaft = orient === "horizontal" && active.wallSystem === "shaft";
  return (
    <>
      <div className="grid grid-cols-2 items-end gap-2">
        <Num label="Width"  value={toDisp(active.width)}  onChange={v => updDim("width", v)} />
        {active.profile === "standard" && !isShaft && <Num label="Height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />}
        {active.profile === "standard" && isShaft && (
          <>
            <Num label="Total shaft height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />
            <Num label="Floor height (slab to soffit)" value={toDisp(active.floorHeight || "")} onChange={v => updDim("floorHeight", v)} />
          </>
        )}
        {active.profile === "rake" && (
          <>
            <Num label="Left height"  value={toDisp(active.leftH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right height" value={toDisp(active.rightH)} onChange={v => updDim("rightH", v)} />
          </>
        )}
        {active.profile === "gable" && (
          <>
            <Num label="Left eaves height"  value={toDisp(active.leftH || active.eavesH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right eaves height" value={toDisp(active.rightH || active.eavesH)} onChange={v => updDim("rightH", v)} />
            <Num label="Ridge / apex height" value={toDisp(active.apexH)} onChange={v => updDim("apexH", v)} />
            <Num label="Ridge from left -- blank = centred" value={toDisp(active.ridgeX)} onChange={v => updDim("ridgeX", v)} />
          </>
        )}
      </div>
      {isShaft && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
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
