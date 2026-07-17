// =============================================================================
// Length Explorer (External Calculator only)
// =============================================================================
// Forked from what used to be a single file shared with InternalCalculator
// (see internalCalculator/lengthExplorer.tsx for its own, independent copy)
// -- identical logic, just no longer a shared file to check for leakage
// against every time either calculator's panel-length UI changes.
// =============================================================================
import { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { r1 } from "../estimate/mathUtils";
import { packPanels, buildOption } from "../estimate/packPanels";
import { cx, NAVY, BLUE } from "../styleTokens";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import { ToggleSwitch, ProjectLockNote } from "../ui/primitives";
import { CustomLengthSection } from "./wallConfig";

// --- LengthExplorer -----------------------------------------------------------
// Shows every candidate stock length with a waste bar so the user can
// instantly compare waste across all options.
export const LengthExplorer = ({
  pieces, stocks, packType, currentStock, onSelect
}: {
  pieces: number[]; stocks: number[]; packType: number;
  currentStock: string; onSelect: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (!pieces || !pieces.length) return [];
    return stocks.map(s => {
      const raw = packPanels([...pieces], s, stocks, false);
      if (raw.exceeds || raw.tooShort) return null;
      const result = buildOption(raw, packType);
      const panels = result.panels ?? 1;
      const offcutPerPanel = panels > 0 ? (result.offcut ?? 0) / panels : 0;
      // % of the stock length that is cut off each panel
      const offcutPct = s > 0 ? Math.round((offcutPerPanel / s) * 1000) / 10 : 0;
      return {
        stock: s,
        label: `${r1(s)} m`,
        panels: result.panels,
        packs: result.packs,
        ordered: result.orderedInPacks,
        offcutPct,
        isSelected: currentStock === String(s),
      };
    }).filter(Boolean);
  }, [pieces, stocks, packType, currentStock]);

  const autoRaw = useMemo(() => {
    if (!pieces || !pieces.length) return null;
    const raw = packPanels([...pieces], null, stocks, false);
    if (raw.exceeds || !raw.groups || !raw.groups.length) return null;
    return buildOption(raw, packType);
  }, [pieces, stocks, packType]);

  const selectedOption = options.find(o => o && o.isSelected);
  const autoSelected = !currentStock;

  const headerLabel = autoSelected
    ? "Length: automatic"
    : selectedOption
      ? `Length: ${selectedOption.label}`
      : "Length: automatic";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/40 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
      >
        <span style={{ color: autoSelected ? "#94a3b8" : NAVY }}>{headerLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {/* Auto option */}
          <button
            onClick={() => { onSelect(""); setOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${autoSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: autoSelected ? BLUE : NAVY }}>
                {autoSelected && "✓ "}Automatic
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {autoRaw ? `Best fit — ${autoRaw.panels} panels, ${Math.round(((autoRaw.offcut ?? 0) / (autoRaw.panels || 1) / ((autoRaw.groups?.[0]?.stock) || 1)) * 1000) / 10}% cut/panel` : "Let the estimator choose"}
              </div>
            </div>
            {autoSelected && <div className="text-xs font-bold uppercase tracking-widest" style={{ color: BLUE }}>Selected</div>}
          </button>

          {/* Per-length options */}
          {options.map(opt => {
            if (!opt) return null;
            const isSelected = opt.isSelected;
            return (
              <button
                key={opt.stock}
                onClick={() => { onSelect(String(opt.stock)); setOpen(false); }}
                className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-bold" style={{ color: isSelected ? BLUE : NAVY }}>
                    {isSelected && "✓ "}{opt.label}
                  </span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{opt.offcutPct}% cut</span>
                </div>
                {/* Waste bar — wider = more cut off, scaled to 50% max */}
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, opt.offcutPct * 2)}%`, background: BLUE, opacity: 0.35 }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {opt.panels} panels · {opt.packs} pack{opt.packs !== 1 ? "s" : ""} · {opt.ordered} ordered
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// --- PanelLengthSection ---------------------------------------------------
// "Panel length" sidebar block: project-lock toggle, this LengthExplorer
// dropdown, the custom-length input, and the project-lock confirmation note.
export interface PanelLengthSectionProps {
  dimUnit: string;
  out: ComputeOut;
  active: Wall;
  walls: Wall[];
  projectLock: boolean;
  projectStock: string;
  customLengthInput: string;
  customActive: boolean;
  stocks: number[];
  packType: number;
  update: (patch: Partial<Wall>) => void;
  setProjectLength: (stock: string, locked: boolean) => void;
  commitCustomLength: (raw: string) => void;
  toggleCustom: () => void;
  clearCustomLength: () => void;
}
export const PanelLengthSection = ({
  dimUnit, out, active, walls, projectLock, projectStock, customLengthInput, customActive,
  stocks, packType, update, setProjectLength, commitCustomLength, toggleCustom, clearCustomLength,
}: PanelLengthSectionProps) => (
  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
    <div className="mb-1.5 flex items-center justify-between">
      <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
      <ToggleSwitch
        active={projectLock}
        label={projectLock ? "Project locked" : "Lock to project"}
        onToggle={() => {
          const currentStock = projectLock ? projectStock : (active.forcedStock || "");
          setProjectLength(customActive ? "" : currentStock, !projectLock);
          if (projectLock) { clearCustomLength(); }
        }}
      />
    </div>
    <LengthExplorer
      pieces={"pieces" in out && out.pieces ? out.pieces : []}
      stocks={stocks}
      packType={packType}
      currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
      onSelect={val => {
        clearCustomLength();
        if (projectLock) { setProjectLength(val, true); }
        else { update({ forcedStock: val }); }
      }}
    />

    {/* Custom length -- same visual treatment as the panel length selector above */}
    <CustomLengthSection
      dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
      projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
      commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
    />

    {/* Project lock confirmation for stocked lengths */}
    {projectLock && !customActive && projectStock && (
      <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
    )}
  </div>
);
