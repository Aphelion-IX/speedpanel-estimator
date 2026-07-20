// =============================================================================
// Order Review drawer (shared -- src/calculator/)
// =============================================================================
// Slide-over (src/ui/drawer.tsx) making the combined order reachable from
// anywhere in the project view without leaving whichever Estimate Results
// tab is open -- same OrderContent the "Order" tab itself renders, plus
// Export to Excel and Copy summary. Save as Project / Request quote /
// Continue to ordering aren't included yet: each needs new prop-threading
// from App.tsx (open-project state, the save flow, project-scoped
// navigation) that's out of scope for wiring up the drawer shell itself --
// the existing "Save as Project" banner and the Project Order Sheet's own
// actions (projectOrderSheet.tsx) stay the primary entry points for those.
// Formerly internalCalculator/orderReviewDrawer.tsx +
// externalCalculator/orderReviewDrawer.tsx.
// =============================================================================
import { FileSpreadsheet, Copy } from "lucide-react";
import { cx } from "../styleTokens";
import { Drawer } from "../ui/drawer";
import type { EffectiveLayout } from "../useLayoutMode";
import type { aggregateProject } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { WallResult } from "../estimate/wall.types";
import type { EstimateReportData } from "../export/reportTypes";
import { determineProjectReadiness } from "../estimate/projectReadiness";
import { buildOrderSummaryText } from "../estimate/copyOrderSummary";
import { copyText } from "../estimate/clipboard";
import type { KitEntry } from "../estimate/synthesizeKits";
import { OrderContent } from "./orderContent";

export const OrderReviewDrawer = ({
  open, onClose, layoutMode, aggProject, combinedEstimate, results, kits, reportData, projectName, onExport, exportDisabled,
}: {
  open: boolean; onClose: () => void; layoutMode: EffectiveLayout;
  aggProject: ReturnType<typeof aggregateProject>; combinedEstimate: CombinedEstimate;
  results: WallResult[];
  kits: KitEntry[]; reportData: EstimateReportData; projectName: string;
  onExport: () => void; exportDisabled: boolean;
}) => {
  const handleCopy = () => {
    const readiness = determineProjectReadiness(results, kits);
    copyText(buildOrderSummaryText(reportData, readiness.state, projectName));
  };
  return (
    <Drawer open={open} onClose={onClose} layoutMode={layoutMode} title="Review order">
      <OrderContent layoutMode={layoutMode} aggProject={aggProject} combinedEstimate={combinedEstimate} results={results} />
      <button onClick={handleCopy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 text-sm font-bold" style={{ color: "var(--navy)" }}>
        <Copy size={16} /> Copy order summary
      </button>
      <button onClick={onExport} disabled={exportDisabled} className={exportDisabled ? cx.exportBtnDisabled : cx.exportBtn}>
        <FileSpreadsheet size={16} /> Export to Excel
      </button>
    </Drawer>
  );
};
