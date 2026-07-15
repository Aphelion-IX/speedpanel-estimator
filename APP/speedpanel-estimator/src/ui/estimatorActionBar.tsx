// =============================================================================
// EstimatorActionBar
// =============================================================================
// Persistent fixed bottom bar for the Estimator, rendered on BOTH layouts (web
// and phone) and in both Single Wall/Project Estimate modes -- generalizes the
// redesign's original StickyBar (phone-only, project-mode-only, Review Order
// button only) into the one persistent action surface: Export to Excel plus
// two visibly-disabled placeholders ("Generate order schedule", "Submit for
// review") signposting workflows that don't exist yet, plus -- in project
// mode -- the project stats + "Review Order" button the old StickyBar showed.
// Single-wall mode shows just Export + the two placeholders; project stats/
// Review Order stay wall-view-agnostic for now (see onReviewOrder below).
// =============================================================================
import { Download, FileSpreadsheet, Send } from "lucide-react";
import { cx } from "../styleTokens";
import { Button } from "./button";

export interface ActionBarStat {
  value: string | number;
  label: string;
}

export const EstimatorActionBar = ({
  hasExportData, onExport, projectStats, onReviewOrder, lineItemCount,
}: {
  hasExportData: boolean; onExport: () => void;
  // Omit projectStats/onReviewOrder entirely in single-wall mode -- there's
  // no project-wide order to review yet.
  projectStats?: ActionBarStat[]; onReviewOrder?: () => void; lineItemCount?: number;
}) => (
  <div className={cx.actionBar}>
    {projectStats && projectStats.length > 0 && (
      <div className="flex flex-1 items-center gap-4 overflow-x-auto">
        {projectStats.map((s, i) => (
          <div key={i} className="shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</div>
            <div className="text-sm font-extrabold leading-tight text-[color:var(--blue)]">{s.value}</div>
          </div>
        ))}
      </div>
    )}
    <Button variant="secondary" disabled className="hidden sm:inline-flex" icon={<FileSpreadsheet size={14} />} title="Coming soon">
      Generate order schedule
    </Button>
    <Button variant="secondary" disabled className="hidden sm:inline-flex" icon={<Send size={14} />} title="Coming soon">
      Submit for review
    </Button>
    {onReviewOrder && (
      <Button variant="secondary" onClick={onReviewOrder}>
        Review Order{typeof lineItemCount === "number" ? ` · ${lineItemCount} line${lineItemCount === 1 ? "" : "s"}` : ""}
      </Button>
    )}
    <Button variant="primary" onClick={onExport} disabled={!hasExportData} icon={<Download size={14} />}>
      Export to Excel
    </Button>
  </div>
);
