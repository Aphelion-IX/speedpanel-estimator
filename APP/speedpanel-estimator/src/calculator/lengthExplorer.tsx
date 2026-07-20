// =============================================================================
// Panel length & materials -- strategy picker (shared -- src/calculator/)
// =============================================================================
// Mockup-matching rebuild (speedpanel-estimator-web-v5.html's `.strategy`/
// `.strategy-card`/`.check-row`/`.custom-row` markup, ported into
// ui/estimatorTheme.css but unused until now) of what used to be an
// accordion-style dropdown (LengthExplorer) listing every candidate stock
// length one at a time. Two named strategies replace it, both reusing the
// exact same packPanels()/buildOption() computation as before -- no new
// business logic, just a different presentation of it:
//   - "Cutting optimiser" is the pre-existing "Automatic" option: packs
//     pieces across whichever stock length(s) minimise waste (buildOption's
//     `cut` flag may be true -- some panels split from a longer stock bar).
//   - "Reduced cutting" is the pre-existing "pick one explicit stock length"
//     mode, now defaulted to the smallest stock where buildOption's own
//     `cut` flag is false (every piece gets its own full-length panel, zero
//     splitting) -- "the nearest stocked length with no panel cuts", per the
//     mockup's own strategy-card copy. Falls back to the smallest valid
//     option if no cut-free stock exists for these pieces.
// The custom-length input keeps its own always-visible section below
// (CustomLengthSection) rather than folding into the strategy select's
// options the way the mockup's static markup shows -- that section already
// has its own real validation (max length, project-lock interaction), so
// conflating the two state mechanisms would risk double-encoding "which
// length is active."
// =============================================================================
import { useEffect, useState } from "react";
import { r1 } from "../estimate/mathUtils";
import { packPanels, buildOption } from "../estimate/packPanels";
import { NAVY } from "../styleTokens";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import { ProjectLockNote } from "../ui/primitives";
import { CustomLengthSection } from "./wallConfig";

interface StockOption {
  stock: number; label: string;
  panels: number; packs: number; ordered: number;
  offcutPct: number; cut: boolean; isSelected: boolean;
}

function computeStockOptions(pieces: number[], stocks: number[], packType: number, currentStock: string): StockOption[] {
  if (!pieces.length) return [];
  return stocks.flatMap(s => {
    const raw = packPanels([...pieces], s, stocks, false);
    if (raw.exceeds || raw.tooShort) return [];
    const result = buildOption(raw, packType);
    const panels = result.panels ?? 1;
    const offcutPerPanel = panels > 0 ? (result.offcut ?? 0) / panels : 0;
    // % of the stock length that is cut off each panel
    const offcutPct = s > 0 ? Math.round((offcutPerPanel / s) * 1000) / 10 : 0;
    return [{
      stock: s, label: `${r1(s)} m`,
      panels: result.panels, packs: result.packs, ordered: result.orderedInPacks,
      offcutPct, cut: result.cut, isSelected: currentStock === String(s),
    }];
  });
}

// --- PanelLengthStrategy ------------------------------------------------------
// The two `.strategy-card`s plus, once "Reduced cutting" is active, the
// select+Apply row for choosing which stock length within that strategy.
const PanelLengthStrategy = ({
  pieces, stocks, packType, currentStock, onSelect,
}: {
  pieces: number[]; stocks: number[]; packType: number;
  currentStock: string; onSelect: (v: string) => void;
}) => {
  const options = computeStockOptions(pieces, stocks, packType, currentStock);
  const noCutOptions = options.filter(o => !o.cut).sort((a, b) => a.stock - b.stock);
  const nearestNoCutStock = noCutOptions[0]?.stock ?? options[0]?.stock;

  const autoOption = pieces.length ? buildOption(packPanels([...pieces], null, stocks, false), packType) : null;
  const optimiserLabel = autoOption && autoOption.groups.length > 0
    ? autoOption.groups.map(g => `${r1(g.stock)} m`).join(" + ")
    : "--";

  const isReduced = !!currentStock;
  const reducedStock = currentStock ? Number(currentStock) : nearestNoCutStock;
  const reducedLabel = reducedStock ? `${r1(reducedStock)} m stock` : "--";

  const [pendingStock, setPendingStock] = useState(currentStock || String(nearestNoCutStock ?? ""));
  useEffect(() => {
    setPendingStock(currentStock || String(nearestNoCutStock ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStock]);

  return (
    <div>
      <label className="label">Panel length strategy</label>
      <div className="strategy">
        <button type="button" className={`strategy-card${isReduced ? " active" : ""}`}
          onClick={() => nearestNoCutStock != null && onSelect(String(currentStock || nearestNoCutStock))}
          disabled={nearestNoCutStock == null}>
          <strong>Reduced cutting</strong>
          <span>Choose the nearest stocked length with no panel cuts.</span>
          <b>{reducedLabel}</b>
        </button>
        <button type="button" className={`strategy-card${!isReduced ? " active" : ""}`}
          onClick={() => onSelect("")}>
          <strong>Cutting optimiser</strong>
          <span>Pack pieces into stocked lengths to reduce waste.</span>
          <b>{optimiserLabel}</b>
        </button>
      </div>

      {isReduced && options.length > 0 && (
        <div className="custom-row mt-3">
          <select className="select" value={pendingStock} onChange={e => setPendingStock(e.target.value)} style={{ color: NAVY }}>
            {options.map(o => (
              <option key={o.stock} value={String(o.stock)}>
                {o.label} stocked panel{o.cut ? "" : " -- no cuts"}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => onSelect(pendingStock)}>Apply</button>
        </div>
      )}
    </div>
  );
};

// --- PanelLengthSection ---------------------------------------------------
// "Panel length" sidebar block: the strategy picker above, the project-lock
// checkbox, the custom-length input, and the project-lock confirmation note.
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
  <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
    <PanelLengthStrategy
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

    <label className="check-row">
      <input type="checkbox" checked={projectLock} onChange={() => {
        const currentStock = projectLock ? projectStock : (active.forcedStock || "");
        setProjectLength(customActive ? "" : currentStock, !projectLock);
        if (projectLock) { clearCustomLength(); }
      }} />
      Lock panel length across the project
    </label>

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
