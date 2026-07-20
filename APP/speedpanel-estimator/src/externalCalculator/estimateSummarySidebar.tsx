// =============================================================================
// Estimate summary sidebar (External Calculator)
// =============================================================================
// Mirrors internalCalculator/estimateSummarySidebar.tsx's mockup-ported
// `.summary` sticky card (see its header comment for the full rationale) --
// no kit/connection concept here, so the summary-lines only show panel
// groups and custom items, and "Estimated waste" reads off the selected
// wall's own result (External's project aggregate has no project-wide
// wastePct field, unlike Internal's). Deliberately its own copy, not shared
// with internalCalculator's mirror -- same fork-not-share convention as
// phoneShell.tsx (see its header comment).
// =============================================================================
import { AlertTriangle, Boxes, Download } from "lucide-react";
import type { WallResult, ComputeOut } from "../estimate/wall.types";
import type { buildExtProjAgg } from "../estimate/aggregate";
import { determineProjectReadiness } from "../estimate/projectReadiness";
import { r1 } from "../estimate/mathUtils";

type ProjAgg = ReturnType<typeof buildExtProjAgg>;

export interface EstimateSummarySidebarProps {
  results: WallResult[];
  out: ComputeOut;
  projAgg: ProjAgg;
  onReviewOrder: () => void;
  onExport: () => void;
  exportDisabled: boolean;
}

export const EstimateSummarySidebar = ({
  results, out, projAgg, onReviewOrder, onExport, exportDisabled,
}: EstimateSummarySidebarProps) => {
  const readiness = determineProjectReadiness(results, []);
  const shownWarnings = readiness.warnings.slice(0, 3);
  const extraWarnings = readiness.warnings.length - shownWarnings.length;
  const customCount = results.filter(r => r.wall.forcedStock).length;

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
          <div className="metric"><strong>{out.empty ? "--" : (out.result?.panels ?? "--")}</strong><span>Selected wall panels</span></div>
          <div className="metric"><strong>{projAgg.panels}</strong><span>Project panels ordered</span></div>
          <div className="metric"><strong>{out.empty ? "--" : `${r1(out.result?.wastePct ?? 0)}%`}</strong><span>Estimated waste</span></div>
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
          <div className="row"><span>Panel groups</span><strong>{projAgg.groups.length} stock length{projAgg.groups.length === 1 ? "" : "s"}</strong></div>
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
