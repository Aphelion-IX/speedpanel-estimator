// =============================================================================
// Copy order summary (plain text)
// =============================================================================
// Spec §7.29: a plain-text version of the complete order, for pasting into
// email/chat/an internal system. Built from the SAME EstimateReportData
// exportEstimateToExcel.ts already assembles via buildInternalReportData/
// buildExternalReportData -- this is a second renderer of already-computed
// data, not a new aggregation pass.
// =============================================================================
import type { EstimateReportData } from "../export/reportTypes";
import { READINESS_LABEL, type ProjectReadiness } from "./projectReadiness";

export function buildOrderSummaryText(reportData: EstimateReportData, readiness: ProjectReadiness, projectName: string): string {
  const lines: string[] = [];
  lines.push(`${projectName || "Untitled project"} -- ${reportData.systemLabel}`);
  lines.push(`Readiness: ${READINESS_LABEL[readiness]}`);
  lines.push("");

  lines.push("Wall schedule:");
  for (const w of reportData.walls) {
    const system = w.system ? ` (${w.system})` : "";
    lines.push(`- ${w.name}: ${w.orientation}${system}, ${w.panelType}, ${w.width} x ${w.height}, ${w.area}, ${w.panels} panels${w.warning ? " -- warning" : ""}`);
  }

  lines.push("");
  lines.push("Panels:");
  for (const g of reportData.panelGroups) {
    lines.push(`- ${g.label}: required ${g.required}, ordered ${g.ordered} (${g.packs} pack(s)), spare ${g.spare}`);
  }
  if (reportData.customPanels.length) {
    lines.push("");
    lines.push("Custom panels:");
    for (const g of reportData.customPanels) lines.push(`- ${g.label}: required ${g.required}, ordered ${g.ordered}, spare ${g.spare}`);
  }

  if (reportData.trackLines.length) {
    lines.push("");
    lines.push("Tracks & flashings:");
    for (const t of reportData.trackLines) lines.push(`- ${t.label}: ${t.pieces} x ${t.stockLabel}`);
  }

  lines.push("");
  lines.push("Fixings & sealant:");
  lines.push(`- 10g x 30 SDS: ${reportData.fixings.fix30} screws (${reportData.fixings.boxes30} box(es))`);
  lines.push(`- 10g x 16 SDS: ${reportData.fixings.fix16} screws (${reportData.fixings.boxes16} box(es))`);
  lines.push(`- ${reportData.fixings.sealantLabel}: ${reportData.fixings.sausages} sausage(s) (${reportData.fixings.sealantBoxes} box(es))`);
  for (const extra of reportData.fixings.extraLines ?? []) lines.push(`- ${extra.label}: ${extra.value}`);

  if (reportData.connections.length) {
    lines.push("");
    lines.push("Connections:");
    for (const c of reportData.connections) {
      lines.push(`- ${c.wallA} + ${c.wallB}: ${c.lengthM} lm, ${c.pieces} piece(s) (${c.reason})`);
    }
  }

  if (reportData.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of reportData.warnings) lines.push(`- ${w}`);
  }

  if (reportData.notes.length) {
    lines.push("");
    lines.push("Notes:");
    for (const n of reportData.notes) lines.push(`- ${n}`);
  }

  lines.push("");
  lines.push(`Generated ${reportData.generatedAt.toLocaleString()}`);
  lines.push("Estimate quantities only. Does not confirm compliance, FRL, engineering, restraint, certification or approval.");

  return lines.join("\n");
}
