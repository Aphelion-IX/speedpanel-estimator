// =============================================================================
// Build order review
// =============================================================================
// Spec §7.23: the structured data behind the Final Order Review screen /
// Project Order Sheet (see internalCalculator/projectOrderSheet.tsx and its
// external mirror). A thin structuring layer over data that's already fully
// computed (EstimateReportData + ProjectReadinessResult) -- no new
// calculation happens here.
// =============================================================================
import type { EstimateReportData } from "../export/reportTypes";
import type { ProjectReadinessResult } from "./projectReadiness";

export interface OrderReviewData {
  projectName: string;
  systemLabel: string;
  generatedAt: Date;
  readiness: ProjectReadinessResult;
  totals: EstimateReportData["totals"];
  walls: EstimateReportData["walls"];
  panelGroups: EstimateReportData["panelGroups"];
  customPanels: EstimateReportData["customPanels"];
  trackLines: EstimateReportData["trackLines"];
  fixings: EstimateReportData["fixings"];
  connections: EstimateReportData["connections"];
  notes: string[];
}

export function buildOrderReview(reportData: EstimateReportData, readiness: ProjectReadinessResult, projectName: string): OrderReviewData {
  return {
    projectName,
    systemLabel: reportData.systemLabel,
    generatedAt: reportData.generatedAt,
    readiness,
    totals: reportData.totals,
    walls: reportData.walls,
    panelGroups: reportData.panelGroups,
    customPanels: reportData.customPanels,
    trackLines: reportData.trackLines,
    fixings: reportData.fixings,
    connections: reportData.connections,
    notes: reportData.notes,
  };
}
