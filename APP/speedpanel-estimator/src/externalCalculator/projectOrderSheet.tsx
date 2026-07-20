// =============================================================================
// Project Order Sheet / Final Order Review (External Calculator only)
// =============================================================================
// Spec §4.5/§7.23 Final Order Review + the v5 mockup's "Project Order Sheet"
// -- mirrors internalCalculator/projectOrderSheet.tsx (see its header
// comment for the full rationale), simplified for External's domain: no
// kits/Corner/Shaft concept, so the KPI strip shows junction connections
// (generic adjoining-wall links) instead of connection kits, and readiness
// is computed from walls alone (no kits array to pass).
//
// Reuses OrderContent (the existing Order tab/drawer's material breakdown)
// and buildExternalReportData's already-computed report snapshot rather
// than re-deriving the same numbers a third time.
//
// Deliberately its own copy, not shared with internalCalculator's mirror --
// same fork-not-share convention as phoneShell.tsx (see its header comment).
// =============================================================================
import { Link2, Copy, Printer, ExternalLink, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { cx, tone, NAVY, BLUE, MUTED } from "../styleTokens";
import { Table, type TableColumn } from "../ui/table";
import type { WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { EstimateReportData, WallSummaryRow } from "../export/reportTypes";
import { determineProjectReadiness, READINESS_LABEL, type ProjectReadinessResult } from "../estimate/projectReadiness";
import { buildOrderSummaryText } from "../estimate/copyOrderSummary";
import { copyText } from "../estimate/clipboard";
import { OrderContent } from "./orderContent";

const READINESS_ICON: Record<ProjectReadinessResult["state"], React.ReactNode> = {
  waitingForInput: <HelpCircle size={18} />,
  orderIncomplete: <XCircle size={18} />,
  readyWithWarnings: <AlertTriangle size={18} />,
  readyToReview: <CheckCircle2 size={18} />,
};
const READINESS_TONE: Record<ProjectReadinessResult["state"], "ok" | "warn" | "danger" | "neutral"> = {
  waitingForInput: "neutral",
  orderIncomplete: "danger",
  readyWithWarnings: "warn",
  readyToReview: "ok",
};

const ReadinessBanner = ({ readiness }: { readiness: ProjectReadinessResult }) => (
  <div className={`flex items-start gap-3 rounded-2xl border p-4 ${tone(READINESS_TONE[readiness.state])}`}>
    <span className="mt-0.5 shrink-0">{READINESS_ICON[readiness.state]}</span>
    <div className="min-w-0">
      <div className="text-sm font-extrabold">{READINESS_LABEL[readiness.state]}</div>
      {readiness.blockers.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-xs">
          {readiness.blockers.map((b, i) => <li key={i}>&bull; {b.wallName}: {b.message}</li>)}
        </ul>
      )}
      {readiness.blockers.length === 0 && readiness.warnings.length > 0 && (
        <ul className="mt-1.5 space-y-1 text-xs">
          {readiness.warnings.map(w => <li key={w.id}>&bull; {w.title} -- {w.affected}: {w.detail}</li>)}
        </ul>
      )}
      {readiness.state === "readyToReview" && <p className="mt-1 text-xs">Every wall is ready and every warning has been reviewed. This is a quantity summary, not an approval.</p>}
    </div>
  </div>
);

const wallScheduleColumns: TableColumn<WallSummaryRow>[] = [
  { key: "name", header: "Wall", cell: r => <span className="font-bold" style={{ color: NAVY }}>{r.name}</span> },
  { key: "orient", header: "Orientation", cell: r => r.orientation === "vertical" ? "Vertical" : "Horizontal" },
  { key: "type", header: "Panel", cell: r => r.panelType },
  { key: "dim", header: "Dimensions", cell: r => `${r.width} x ${r.height}` },
  { key: "area", header: "Area", cell: r => r.area },
  { key: "panels", header: "Panels", cell: r => r.panels, align: "right" },
  { key: "warn", header: "Warnings", cell: r => r.warning ? <span className={`${cx.badge} ${tone("warn")}`}>Review</span> : "None" },
];

export interface ProjectOrderSheetProps {
  layoutMode: EffectiveLayout;
  projectName: string;
  results: WallResult[];
  projAgg: ReturnType<typeof buildExtProjAgg>;
  combinedEstimate: CombinedEstimate;
  reportData: EstimateReportData;
  onExportExcel: () => void;
  exportDisabled: boolean;
  // Standalone clean page (spec §7.30 printOrderReview) -- drops the
  // embedded section's outer card chrome/heading in favour of the page's
  // own minimal brand bar (see projectOrderSheetPage.tsx).
  standalone?: boolean;
}

export const ProjectOrderSheet = ({
  layoutMode, projectName, results, projAgg, combinedEstimate, reportData,
  onExportExcel, exportDisabled, standalone = false,
}: ProjectOrderSheetProps) => {
  const readiness = determineProjectReadiness(results, []);
  const handleCopy = () => copyText(buildOrderSummaryText(reportData, readiness.state, projectName));

  return (
    <div id="project-order-sheet" className={standalone ? "" : "mt-3"}>
      {/* Same "hide everything except this element" print pattern as the v5
          mockup -- see internalCalculator/projectOrderSheet.tsx's header
          comment for why this is a scoped inline stylesheet, not a new
          global CSS file. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #project-order-sheet, #project-order-sheet * { visibility: visible !important; }
          #project-order-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          #project-order-sheet .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className={standalone ? "" : cx.section}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={cx.eyebrow}>Complete project totals</span>
            <h2 className={cx.h2 + " mt-1"}>Project Order Sheet{projectName ? ` — ${projectName}` : ""}</h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              All panels, tracks, flashings, connection materials, fixings, sealants and allowances in one sendable summary.
            </p>
          </div>
          <div className="print:hidden flex flex-wrap gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold" style={{ color: NAVY }}>
              <Copy size={14} />Copy summary
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold" style={{ color: NAVY }}>
              <Printer size={14} />Print / Save PDF
            </button>
            {!standalone && (
              <a href="#/estimator/order-sheet" target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white" style={{ background: BLUE }}>
                <ExternalLink size={14} />Open clean order sheet
              </a>
            )}
          </div>
        </div>

        <div className="mt-4"><ReadinessBanner readiness={readiness} /></div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={cx.infoBox}><div className={cx.infoBoxHd}>Panels ordered</div><div className={cx.infoBoxVal}>{reportData.totals.panels}</div></div>
          <div className={cx.infoBox}><div className={cx.infoBoxHd}>Panel packs</div><div className={cx.infoBoxVal}>{reportData.totals.packs ?? "--"}</div></div>
          <div className={cx.infoBox}><div className={cx.infoBoxHd}>Total area</div><div className={cx.infoBoxVal}>{reportData.totals.area} m²</div></div>
          <div className={cx.infoBox}>
            <div className={cx.infoBoxHd}>Connections</div>
            <div className={cx.infoBoxVal}>
              <Link2 size={14} className="mr-1 inline align-[-2px]" style={{ color: BLUE }} />{combinedEstimate.connections.length}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className={cx.cardHd}>Wall schedule</div>
          <Table columns={wallScheduleColumns} rows={reportData.walls} rowKey={(r, i) => `${r.name}-${i}`} />
        </div>

        <div className="mt-5">
          <div className={cx.cardHd}>Complete material order</div>
          <OrderContent layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
        </div>

        <p className={cx.warnbox + " mt-5"}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          This is a quantity and ordering summary. It does not confirm compliance, FRL, engineering, restraint, certification or approval. Structure fixings remain by others.
        </p>

        <div className="print:hidden mt-5 border-t border-slate-100 dark:border-slate-700 pt-4">
          <button onClick={onExportExcel} disabled={exportDisabled} className={exportDisabled ? cx.exportBtnDisabled : cx.exportBtn}>
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
};
