import { describe, it, expect } from "vitest";
import { buildOrderSummaryText } from "./copyOrderSummary";
import type { EstimateReportData } from "../export/reportTypes";

const reportData: EstimateReportData = {
  systemLabel: "Internal calculator - Vertical",
  generatedAt: new Date("2026-01-01T00:00:00Z"),
  totals: { area: 12.3, panels: 34, packs: 3, wastePct: 9.6 },
  walls: [
    { name: "Wall 01", orientation: "vertical", panelType: "P78", width: "3.2 m", height: "2.4 m", area: "7.7 m2", panels: "34", warning: false },
  ],
  panelGroups: [
    { label: "P78 - 4.5 m", status: "Stocked", required: 39, packSize: 14, packs: 3, ordered: 42, spare: 3, panelType: 78 },
  ],
  customPanels: [],
  trackLines: [
    { label: "C Track", pieces: 8, lengthM: 45.6, stockLabel: "6.0 m" },
  ],
  fixings: { fix30: 640, boxes30: 1, fix16: 420, boxes16: 1, sealantLabel: "Hilti CP606", sealantBoxes: 2, sausages: 22, area: 12.3 },
  connections: [],
  notes: ["Example note."],
  warnings: ["Example warning."],
};

describe("buildOrderSummaryText", () => {
  it("includes the project name, readiness, and every material category", () => {
    const text = buildOrderSummaryText(reportData, "readyWithWarnings", "Front Lobby Project");
    expect(text).toContain("Front Lobby Project");
    expect(text).toContain("Ready with warnings");
    expect(text).toContain("Wall 01");
    expect(text).toContain("P78 - 4.5 m");
    expect(text).toContain("C Track");
    expect(text).toContain("Hilti CP606");
    expect(text).toContain("Example warning.");
    expect(text).toContain("Example note.");
  });

  it("falls back to a placeholder name for an unnamed draft", () => {
    const text = buildOrderSummaryText(reportData, "waitingForInput", "");
    expect(text).toContain("Untitled project");
  });
});
