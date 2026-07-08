// =============================================================================
// exportEstimateToExcel
// =============================================================================
// The one side-effecting call site: builds the workbook (./buildWorkbook.ts)
// from report data and triggers a browser download. Filename embeds the
// system label and today's date so repeat exports don't silently overwrite
// each other in the user's Downloads folder.
// =============================================================================
import * as XLSX from "xlsx";
import { buildWorkbook } from "./buildWorkbook";
import type { EstimateReportData } from "./reportTypes";

function slugify(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "estimate";
}

export function exportEstimateToExcel(data: EstimateReportData): void {
  const wb = buildWorkbook(data);
  const date = data.generatedAt.toISOString().slice(0, 10);
  const filename = `Speedpanel-Estimate-${slugify(data.systemLabel)}-${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}
