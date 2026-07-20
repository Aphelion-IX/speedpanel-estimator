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
import { Copy, Printer, ExternalLink, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { tone } from "../styleTokens";
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

// Spec §12.3: "On phone, the Final Order Review must not render a desktop-
// width table. Use one grouped card per wall or material line." -- mirrors
// internalCalculator/projectOrderSheet.tsx's identical component (the
// mockup's own `.order-mobile-row` shape).
const WallScheduleMobileCard = ({ wall }: { wall: WallSummaryRow }) => (
  <div className="order-mobile-row">
    <div className="top">
      <strong>{wall.name}</strong>
      {wall.warning ? <span className="pill red">Review</span> : <span className="pill cyan">{wall.panels} panels</span>}
    </div>
    <div className="meta">
      <span><b>Orientation:</b> {wall.orientation === "vertical" ? "Vertical" : "Horizontal"}</span>
      <span><b>Panel:</b> {wall.panelType}</span>
      <span><b>Size:</b> {wall.width} x {wall.height}</span>
      <span><b>Area:</b> {wall.area}</span>
    </div>
  </div>
);

// The mockup's own `.order-table` markup, mirrors
// internalCalculator/projectOrderSheet.tsx's identical component (see its
// header comment for why this bypasses the sitewide ui/table.tsx <Table>).
const WallScheduleTable = ({ rows }: { rows: WallSummaryRow[] }) => (
  <div className="order-table-wrap">
    <table className="order-table">
      <thead>
        <tr><th>Wall</th><th>Orientation</th><th>Panel</th><th>Dimensions</th><th>Area</th><th>Panels</th><th>Warnings</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td><strong>{r.name}</strong></td>
            <td>{r.orientation === "vertical" ? "Vertical" : "Horizontal"}</td>
            <td>{r.panelType}</td>
            <td>{r.width} x {r.height}</td>
            <td>{r.area}</td>
            <td className="qty">{r.panels}</td>
            <td>{r.warning ? <span className="pill red">Review</span> : "None"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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

      <section className="project-order-sheet" style={standalone ? { marginTop: 0 } : undefined}>
        <div className="project-order-head">
          <div className="min-w-0">
            <span className="eyebrow">Complete project totals</span>
            <h2>Project Order Sheet{projectName ? ` — ${projectName}` : ""}</h2>
            <p>All panels, tracks, flashings, connection materials, fixings, sealants and allowances in one sendable summary.</p>
          </div>
          <div className="project-order-actions print:hidden">
            <button className="btn" onClick={handleCopy}><Copy size={14} />Copy summary</button>
            <button className="btn" onClick={() => window.print()}><Printer size={14} />Print / Save PDF</button>
            {!standalone && (
              <a href="#/estimator/order-sheet" target="_blank" rel="noreferrer" className="btn primary">
                <ExternalLink size={14} />Open clean order sheet
              </a>
            )}
          </div>
        </div>

        <div className="order-kpis">
          <div className="order-kpi primary"><strong>{reportData.totals.panels}</strong><span>Panels ordered</span></div>
          <div className="order-kpi"><strong>{reportData.totals.packs ?? "--"}</strong><span>Panel packs</span></div>
          <div className="order-kpi cyan"><strong>{reportData.totals.area} m²</strong><span>Total area</span></div>
          <div className="order-kpi"><strong>{combinedEstimate.connections.length}</strong><span>Connections</span></div>
        </div>

        <div className="order-sheet-body">
          <div style={{ marginBottom: 17 }}><ReadinessBanner readiness={readiness} /></div>

          <div className="order-sheet-section">
            <h3>Wall schedule</h3>
            {layoutMode === "phone" ? (
              <div>
                {reportData.walls.map((w, i) => <WallScheduleMobileCard key={`${w.name}-${i}`} wall={w} />)}
              </div>
            ) : (
              <WallScheduleTable rows={reportData.walls} />
            )}
          </div>

          <div className="order-sheet-section">
            <h3>Complete material order</h3>
            <OrderContent layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
          </div>

          <div className="order-sheet-note">
            <AlertTriangle size={14} />
            <span><strong>Important:</strong> This is a quantity and ordering summary. It does not confirm compliance, FRL, engineering, restraint, certification or approval. Structure fixings remain by others.</span>
          </div>

          <div className="print:hidden" style={{ marginTop: 20 }}>
            <button className="btn primary" onClick={onExportExcel} disabled={exportDisabled}>Export to Excel</button>
          </div>
        </div>
      </section>
    </div>
  );
};
