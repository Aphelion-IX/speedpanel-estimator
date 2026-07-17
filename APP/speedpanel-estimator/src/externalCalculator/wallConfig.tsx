// =============================================================================
// Wall configuration inputs (External Calculator only)
// =============================================================================
// Wall-configuration form pieces: the span table lookup display, panel
// profile selector/section, edge restraint (head/base/left/right + head
// flashing + corner angles) selector, project-length separator, and the
// custom-length section.
//
// Forked from what used to be a single file shared with InternalCalculator
// (see internalCalculator/wallConfig.tsx for its own, independent copy).
// External is always P78, always "standard" wall system, and never used the
// advanced C/J track-finish picker (its EdgeRestraintSelector call never
// passed showTrackFinish/activeFinishes) -- so this copy doesn't carry
// TrackFinishBlock, OtherOptionsBlock, or SpanTable's Standard/Corner/Shaft
// wall-system branches at all, rather than keeping them present-but-unused.
// =============================================================================
import { useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import { cx, NAVY, BLUE, MUTED, selectedFill, selectableOffCx } from "../styleTokens";
import {
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ, RAKE_NOTE, CUSTOM_MAX_LENGTH,
} from "../data";
import type { Wall, ComputeOut, DimField, EdgeState } from "../estimate/wall.types";
import { Num, ToggleSwitch, ProjectLockNote } from "../ui/primitives";
import { Table, type TableColumn } from "../ui/table";
import { makeToM } from "../estimate/computeUtils";

// --- SpanTable ----------------------------------------------------------------
export const SpanTable = ({ orient, type }: { orient: string; type: number }) => {
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
export const ProfileSelector = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    {([ ["standard","Standard"], ["rake","Raked"], ["gable","Gable"] ] as [ProfileId, string][]).map(([id, lbl]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
          style={on ? { ...selectedFill, color: "#fff" } : { color: BLUE }}>{lbl}</button>
      );
    })}
  </div>
);

// --- EdgeRestraintSelector ----------------------------------------------------
export type CornersField = "intCorners" | "extCorners";
export type EdgeOption = { key: string; label: string; sublabel?: string; value: boolean; onToggle: () => void };
export type CornersValue = { intCorners: string; extCorners: string; onChange: (field: CornersField, val: string) => void };

export interface EdgeRestraintProps {
  edges: EdgeState;
  onEdgeToggle: (k: keyof EdgeState) => void;
  options?: EdgeOption[];
  corners?: CornersValue;
  locked?: boolean;
}

const EdgeBtn = ({ edgeKey, label, edges, locked, onEdgeToggle }: {
  edgeKey: keyof EdgeState; label: string; edges: EdgeState; locked: boolean; onEdgeToggle: (k: keyof EdgeState) => void;
}) => {
  const on = locked || edges[edgeKey];
  return (
    <button onClick={locked ? undefined : () => onEdgeToggle(edgeKey)} disabled={locked}
      className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center transition-all " + (locked ? "cursor-default" : "active:scale-95 hover:-translate-y-0.5") + (on ? "" : " border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-blue-200 dark:hover:border-blue-700")}
      style={on
        ? { borderColor: BLUE, background: BLUE, color: "#fff", opacity: locked ? 0.85 : 1, boxShadow: locked ? undefined : `0 10px 20px -10px color-mix(in srgb, ${BLUE} 55%, transparent), inset 0 1px 1px rgba(255,255,255,0.25)` }
        : { color: MUTED }}>
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
      <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
        Standard wall assumes all four edges restrained (slab, soffit, and structure both sides).
      </p>
    )}
  </div>
);

export const HeadFlashingToggle = ({ flashOption }: { flashOption: EdgeOption }) => (
  <div className="flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-4 py-2">
    <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Head track flashing</span>
    <button onClick={flashOption.onToggle}
      style={{
        background: flashOption.value ? BLUE : MUTED,
        width: 44, height: 24, borderRadius: 12, position: "relative",
        border: "none", cursor: "pointer",
        boxShadow: flashOption.value ? `0 0 0 4px color-mix(in srgb, ${BLUE} 14%, transparent), inset 0 1px 1px rgba(255,255,255,0.25)` : "inset 0 1px 2px rgba(12,35,64,0.15)",
        transition: "background 0.2s, box-shadow 0.2s", flexShrink: 0,
      }}>
      <span style={{
        position: "absolute", top: 2, left: flashOption.value ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s", display: "block",
      }} />
    </button>
  </div>
);

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
  edges, onEdgeToggle, options = [],
  corners = { intCorners: "", extCorners: "", onChange: () => {} },
  locked = false,
}: EdgeRestraintProps) => {
  const flashOption = options.find(o => o.key === "headFlash");

  // No wrapping cx.section here -- the sole caller (ExternalCalculator's
  // tracksContent) always renders this inside a CollapsibleSection, whose
  // own body wrapper now supplies that padding/spacing/card shell.
  return (
    <>
      <RestrainedEdgesBlock edges={edges} onEdgeToggle={onEdgeToggle} locked={locked} />
      {flashOption && <HeadFlashingToggle flashOption={flashOption} />}
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
export const DimensionInputs = ({ active, toDisp, updDim, out, orient }: DimensionInputsProps) => (
  <>
    <div className="grid grid-cols-2 items-end gap-2">
      <Num label="Width"  value={toDisp(active.width)}  onChange={v => updDim("width", v)} />
      {active.profile === "standard" && <Num label="Height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />}
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
    {!out.empty && (out.maxH || 0) > 6.1 && orient === "vertical" && (
      <p className={cx.infoNote}>
        <span className="mt-0.5 shrink-0">i</span>
        Panels greater than 6.0 m are heavier and harder to handle on site. Speak to Speedpanel about installing a nib.
      </p>
    )}
  </>
);
