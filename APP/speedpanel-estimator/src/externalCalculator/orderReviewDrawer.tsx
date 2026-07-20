// =============================================================================
// Order Review drawer (External)
// =============================================================================
// Mirrors internalCalculator/orderReviewDrawer.tsx -- same OrderContent the
// "Order" tab renders, plus Export to Excel and Copy summary. Save as
// Project / Request quote / Continue to ordering aren't included yet, same
// reasoning as Internal's version.
// =============================================================================
import { FileSpreadsheet, Copy } from "lucide-react";
import { cx } from "../styleTokens";
import { Drawer } from "../ui/drawer";
import type { EffectiveLayout } from "../useLayoutMode";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { WallResult } from "../estimate/wall.types";
import type { EstimateReportData } from "../export/reportTypes";
import { determineProjectReadiness } from "../estimate/projectReadiness";
import { buildOrderSummaryText } from "../estimate/copyOrderSummary";
import { copyText } from "../estimate/clipboard";
import { OrderContent } from "./orderContent";

export const OrderReviewDrawer = ({
  open, onClose, layoutMode, projAgg, combinedEstimate, results, reportData, projectName, onExport, exportDisabled,
}: {
  open: boolean; onClose: () => void; layoutMode: EffectiveLayout;
  projAgg: ReturnType<typeof buildExtProjAgg>; combinedEstimate: CombinedEstimate;
  results: WallResult[]; reportData: EstimateReportData; projectName: string;
  onExport: () => void; exportDisabled: boolean;
}) => {
  const handleCopy = () => {
    const readiness = determineProjectReadiness(results, []);
    copyText(buildOrderSummaryText(reportData, readiness.state, projectName));
  };
  return (
    <Drawer open={open} onClose={onClose} layoutMode={layoutMode} title="Review order">
      <OrderContent layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
      <button onClick={handleCopy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-3 text-sm font-bold" style={{ color: "var(--navy)" }}>
        <Copy size={16} /> Copy order summary
      </button>
      <button onClick={onExport} disabled={exportDisabled} className={exportDisabled ? cx.exportBtnDisabled : cx.exportBtn}>
        <FileSpreadsheet size={16} /> Export to Excel
      </button>
    </Drawer>
  );
};
