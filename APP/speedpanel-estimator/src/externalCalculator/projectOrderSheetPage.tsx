// =============================================================================
// Project Order Sheet page (standalone, External Calculator only)
// =============================================================================
// The "clean order sheet" route (#/estimator/order-sheet) for an External
// project -- mirrors internalCalculator/projectOrderSheetPage.tsx (see its
// header comment for the full "no app chrome, same precedent as
// ProformaInvoicePage.tsx" rationale).
// =============================================================================
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { NAVY, BLUE, MUTED } from "../styleTokens";
import { useWallResults } from "../wallStore";
import type { WallStore } from "../wallStore";
import { computeExternal } from "../estimate/computeWall";
import { buildExtProjAgg } from "../estimate/aggregate";
import { useCombinedEstimateCalc } from "../estimate/useCombinedEstimateCalc";
import { buildExternalReportData } from "../export/buildExternalReportData";
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
  const { results, warnById } = useWallResults(walls, activeId, computeExternal);
  const projAgg = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);
  const reportData = useMemo(() => buildExternalReportData({
    orient: active.orient, dimUnit, toDisp, walls, results, warnById, projAgg, combinedEstimate,
  }), [active.orient, dimUnit, toDisp, walls, results, warnById, projAgg, combinedEstimate]);
  const hasExportData = projAgg.panels > 0;

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
          results={results} projAgg={projAgg} combinedEstimate={combinedEstimate}
          reportData={reportData}
          onExportExcel={() => exportEstimateToExcel(reportData)} exportDisabled={!hasExportData}
          standalone
        />
      </div>
    </div>
  );
};
