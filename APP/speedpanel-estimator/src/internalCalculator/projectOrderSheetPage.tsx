// =============================================================================
// Project Order Sheet page (standalone, Internal Calculator only)
// =============================================================================
// The "clean order sheet" route (#/estimator/order-sheet) -- no TopNav/app
// chrome at all, same precedent as ProformaInvoicePage.tsx (see its header
// comment: a printable/copyable document isn't a page in the app, so it
// doesn't get the app's own navigation). App.tsx renders this as an early
// branch before the normal shell, exactly like the proforma route.
//
// Recomputes results/kits/aggregate/combinedEstimate/reportData from the
// SAME shared store InternalCalculator.tsx reads (see wallStore.ts) --
// duplicated derivation (cheap useMemo calls over already-loaded state, not
// duplicated business logic) rather than threading this page's props
// through InternalCalculator's own render tree, so the clean route works
// whether or not the full calculator UI is even mounted.
// =============================================================================
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { NAVY, BLUE, MUTED } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { compute } from "../estimate/computeWall";
import { aggregate } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { synthesizeKits } from "../estimate/synthesizeKits";
import { INT_CONFIG } from "../data";
import { buildInternalReportData } from "../export/buildInternalReportData";
import { exportEstimateToExcel } from "../export/exportEstimateToExcel";
import type { EffectiveLayout } from "../useLayoutMode";
import { ProjectOrderSheet } from "./projectOrderSheet";

export interface ProjectOrderSheetPageProps {
  store: WallStore;
  dimUnit: string;
  layoutMode: EffectiveLayout;
  projectName: string;
  onBack: () => void;
}

export const ProjectOrderSheetPage = ({ store, dimUnit, layoutMode, projectName, onBack }: ProjectOrderSheetPageProps) => {
  const { walls, activeId, active, toDisp } = store;
  const { results, warnById } = useWallResults(walls, activeId, compute);
  const kits = useMemo(() => synthesizeKits(walls, INT_CONFIG), [walls]);
  const projChosenAgg = useMemo(() => aggregate(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  const reportData = useMemo(() => buildInternalReportData({
    orient: active.orient, dimUnit, toDisp, walls, results, warnById, projChosenAgg, combinedEstimate,
  }), [active.orient, dimUnit, toDisp, walls, results, warnById, projChosenAgg, combinedEstimate]);
  const hasExportData = !!(projChosenAgg && projChosenAgg.totalPanels > 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-6 sm:py-10" style={{ color: NAVY }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="print:hidden mb-4 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
            <ArrowLeft size={14} />Back to estimator
          </button>
          <span className="text-sm font-black" style={{ color: NAVY }}><b style={{ color: BLUE, fontStyle: "italic" }}>my</b>SPEEDPANEL &middot; Project Order Sheet</span>
        </div>
        <p className="print:hidden mb-4 text-xs" style={{ color: MUTED }}>
          A standalone, printable/copyable version of the project order -- no editing controls, so it's safe to share or save as a PDF.
        </p>
        <ProjectOrderSheet
          layoutMode={layoutMode} projectName={projectName}
          results={results} kits={kits} projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate}
          reportData={reportData}
          onExportExcel={() => exportEstimateToExcel(reportData)} exportDisabled={!hasExportData}
          standalone
        />
      </div>
    </div>
  );
};
