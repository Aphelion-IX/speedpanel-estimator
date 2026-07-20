// =============================================================================
// Project Order Sheet / Final Order Review (shared -- src/calculator/)
// =============================================================================
// Spec §4.5/§7.23 Final Order Review + the v5 mockup's "Project Order Sheet":
// a readiness checkpoint (§6) plus the wall schedule and complete material
// order in one place, with Copy summary / Print / Export to Excel actions.
// Rendered TWICE from this one component (spec's own "embedded section +
// standalone clean page" split) -- once inline after EstimateResultsCard in
// Calculator.tsx's mainNode (embedded prop, default), and once alone via
// projectOrderSheetPage.tsx's standalone route (standalone prop) -- see that
// file for why a route-level wrapper exists rather than branching inside
// App.tsx directly.
//
// Reuses OrderContent (the existing Order tab/drawer's material breakdown)
// for the panel/track/connection/fixing cards rather than re-deriving the
// same numbers into a second table shape -- only the wall schedule table and
// the readiness/KPI/actions chrome around it are new here. The wall schedule
// table's "System" column reads a per-row optional `system` label (Internal
// wallSystem name, e.g. "Corner wall") -- undefined for External rows, which
// just fall back to showing orientation alone, so one table serves both.
//
// Formerly internalCalculator/projectOrderSheet.tsx (kits-aware "System"
// column) + externalCalculator/projectOrderSheet.tsx (Orientation-only
// column, no kits) -- Internal's version was already a safe superset since
// its `system` column degrades gracefully when a row has no system label.
// =============================================================================
import { Copy, Printer, ExternalLink, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { tone } from "../styleTokens";
import type { WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import type { aggregateProject } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { EstimateReportData, WallSummaryRow } from "../export/reportTypes";
import { determineProjectReadiness, READINESS_LABEL, type ProjectReadinessResult } from "../estimate/projectReadiness";
import { buildOrderSummaryText } from "../estimate/copyOrderSummary";
import { copyText } from "../estimate/clipboard";
import type { KitEntry } from "../estimate/synthesizeKits";
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
// width table. Use one grouped card per wall or material line." -- the
// mockup's own `.order-mobile-row` shape (speedpanel-project-order-sheet-
// v5.html), used here on phone instead of the `.order-table` below.
const WallScheduleMobileCard = ({ wall }: { wall: WallSummaryRow }) => (
  <div className="order-mobile-row">
    <div className="top">
      <strong>{wall.name}</strong>
      {wall.warning ? <span className="pill red">Review</span> : <span className="pill cyan">{wall.panels} panels</span>}
    </div>
    <div className="meta">
      <span><b>System:</b> {wall.orientation === "vertical" ? "Vertical" : "Horizontal"}{wall.system ? ` · ${wall.system}` : ""}</span>
      <span><b>Panel:</b> {wall.panelType}</span>
      <span><b>Size:</b> {wall.width} x {wall.height}</span>
      <span><b>Area:</b> {wall.area}</span>
    </div>
  </div>
);

// The mockup's own `.order-table` markup (speedpanel-project-order-sheet-
// v5.html) written directly here rather than through the sitewide ui/
// table.tsx <Table> -- that component is also used outside the estimator
// (ProjectDetailPage.tsx and others), so its own styling stays untouched.
const WallScheduleTable = ({ rows }: { rows: WallSummaryRow[] }) => (
  <div className="order-table-wrap">
    <table className="order-table">
      <thead>
        <tr><th>Wall</th><th>System</th><th>Panel</th><th>Dimensions</th><th>Area</th><th>Panels</th><th>Warnings</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.name}-${i}`}>
            <td><strong>{r.name}</strong></td>
            <td>{r.orientation === "vertical" ? "Vertical" : "Horizontal"}{r.system ? ` · ${r.system}` : ""}</td>
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
  kits: KitEntry[];
  aggProject: ReturnType<typeof aggregateProject>;
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
  layoutMode, projectName, results, kits, aggProject, combinedEstimate, reportData,
  onExportExcel, exportDisabled, standalone = false,
}: ProjectOrderSheetProps) => {
  const readiness = determineProjectReadiness(results, kits);
  const handleCopy = () => copyText(buildOrderSummaryText(reportData, readiness.state, projectName));

  return (
    <div id="project-order-sheet" className={standalone ? "" : "mt-3"}>
      {/* Print stylesheet: same "hide everything except this element" pattern
          as the v5 mockup's own #project-order-sheet print rules -- scoped
          inline here rather than a new global CSS file, since this is the
          only place in the app that needs it (see reportOrderReview.tsx's
          header comment; print was previously removed app-wide in favour of
          Excel export, per ProformaInvoicePage.tsx's own history). */}
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
          <div className="order-kpi"><strong>{kits.length}</strong><span>Connection kits</span></div>
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
            <OrderContent layoutMode={layoutMode} aggProject={aggProject} combinedEstimate={combinedEstimate} results={results} />
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
