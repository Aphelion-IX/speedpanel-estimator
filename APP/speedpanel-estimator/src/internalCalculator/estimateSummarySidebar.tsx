// =============================================================================
// Estimate summary sidebar (Internal Calculator)
// =============================================================================
// The mockup's `.summary` sticky card -- right column of the desktop
// `.workspace` 3-column grid (see ui/estimatorTheme.css and
// InternalCalculator.tsx's webWorkspaceNode). Live KPI metrics for the
// selected wall/kit plus the whole project, a "% configured" progress bar
// (same configuredCount/totalItems formula EstimateTopCard.tsx used before
// the mockup restyle moved it here), a rollup of outstanding warnings (via
// ../estimate/projectReadiness.ts's determineProjectReadiness, so this can't
// drift out of sync with the Order Review drawer's own readiness read), and
// the two summary-lines/actions rows. Deliberately its own copy, not shared
// with externalCalculator's mirror -- same fork-not-share convention as
// phoneShell.tsx (see its header comment).
// =============================================================================
import { AlertTriangle, Boxes, Download } from "lucide-react";
import type { WallResult, ComputeOut } from "../estimate/wall.types";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { Wall } from "../estimate/wall.types";
import type { aggregate } from "../estimate/aggregate";
import { isConfigured, deriveWallStatus } from "./phoneShell";
import { determineProjectReadiness } from "../estimate/projectReadiness";

type ProjAgg = ReturnType<typeof aggregate>;

export interface EstimateSummarySidebarProps {
  walls: Wall[];
  results: WallResult[];
  kits: KitEntry[];
  out: ComputeOut;
  projChosenAgg: ProjAgg;
  onReviewOrder: () => void;
  onExport: () => void;
  exportDisabled: boolean;
}

function kitCountLine(kits: KitEntry[]): string {
  if (kits.length === 0) return "None";
  if (kits.length === 1) return `1 ${kits[0].kind === "corner" ? "corner kit" : "shaft junction"}`;
  return `${kits.length} kits`;
}

export const EstimateSummarySidebar = ({
  walls, results, kits, out, projChosenAgg, onReviewOrder, onExport, exportDisabled,
}: EstimateSummarySidebarProps) => {
  const totalItems = results.length + kits.length;
  const configuredCount = results.filter(r => isConfigured(deriveWallStatus(r.wall, walls, r.out))).length + kits.length;
  const pct = totalItems ? Math.round((configuredCount / totalItems) * 100) : 0;

  const readiness = determineProjectReadiness(results, kits);
  const shownWarnings = readiness.warnings.slice(0, 3);
  const extraWarnings = readiness.warnings.length - shownWarnings.length;

  const stockGroupCount = projChosenAgg.panels.length + projChosenAgg.customPanels.length;
  const customCount = projChosenAgg.customPanels.length;

  return (
    <aside className="summary card">
      <div className="card-hd">
        <div>
          <span className="eyebrow">Live project estimate</span>
          <div className="card-title">Order snapshot</div>
        </div>
        <span className="pill cyan">{results.length} wall{results.length === 1 ? "" : "s"}</span>
      </div>
      <div className="summary-body">
        <div className="summary-metrics">
          <div className="metric"><strong>{out.empty ? "--" : `${out.area} m²`}</strong><span>Selected wall area</span></div>
          <div className="metric"><strong>{out.empty ? "--" : (out.chosen?.panels ?? "--")}</strong><span>Selected wall panels</span></div>
          <div className="metric"><strong>{projChosenAgg.totalPanels}</strong><span>Project panels ordered</span></div>
          <div className="metric"><strong>{projChosenAgg.wastePct}%</strong><span>Estimated waste</span></div>
        </div>
        <div className="progress-block">
          <div><span>Estimate configured</span><b>{pct}%</b></div>
          <div className="progress"><i style={{ width: `${pct}%` }} /></div>
        </div>
        {shownWarnings.length > 0 && (
          <div className="warning-list">
            {shownWarnings.map(w => (
              <div key={w.id} className="warning-item">
                <AlertTriangle size={16} />
                <div><strong>{w.affected} -- {w.title}</strong><span>{w.detail}</span></div>
              </div>
            ))}
            {extraWarnings > 0 && (
              <div className="warning-item"><AlertTriangle size={16} /><div><strong>{extraWarnings} more warning{extraWarnings === 1 ? "" : "s"}</strong><span>See the Order tab for the full list.</span></div></div>
            )}
          </div>
        )}
        <div className="summary-lines">
          <div className="row"><span>Panel groups</span><strong>{stockGroupCount} stock length{stockGroupCount === 1 ? "" : "s"}</strong></div>
          <div className="row"><span>Connection kits</span><strong>{kitCountLine(kits)}</strong></div>
          <div className="row"><span>Custom items</span><strong>{customCount === 0 ? "None" : `${customCount} custom length${customCount === 1 ? "" : "s"}`}</strong></div>
        </div>
        <button className="btn primary full" onClick={onReviewOrder}>
          <Boxes size={15} />Review complete order
        </button>
        <button className="btn full" onClick={onExport} disabled={exportDisabled}>
          <Download size={15} />Export estimate to Excel
        </button>
      </div>
    </aside>
  );
};
