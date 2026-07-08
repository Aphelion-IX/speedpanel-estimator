import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbook } from "./buildWorkbook";
import type { EstimateReportData } from "./reportTypes";

function baseReport(overrides: Partial<EstimateReportData> = {}): EstimateReportData {
  return {
    systemLabel: "Internal calculator - Vertical",
    modeLabel: "Project",
    generatedAt: new Date("2026-01-01T00:00:00Z"),
    totals: { area: 12.34, panels: 5, packs: 2, wastePct: 8.1 },
    walls: [
      { name: "Wall 1", orientation: "vertical", panelType: "P51", width: "3 m", height: "3 m", area: "9 m2", panels: "3", warning: false },
    ],
    panelGroups: [
      { label: "P51 - 3.0 m", status: "Stocked", required: 3, packSize: 21, packs: 1, ordered: 21, spare: 18 },
    ],
    customPanels: [],
    trackLines: [
      { label: "C-track perimeter - test", pieces: 4, lengthM: 12, stockLabel: "stocked @ 6.0 m" },
    ],
    fixings: {
      fix30: 20, boxes30: 1, fix16: 10, boxes16: 1,
      sealantLabel: "Hilti CP606 sealant", sealantBoxes: 1, sausages: 3, area: 9,
    },
    connections: [],
    notes: [],
    warnings: [],
    ...overrides,
  };
}

describe("buildWorkbook", () => {
  it("builds the core sheets without a Connections sheet when there are none", () => {
    const wb = buildWorkbook(baseReport());
    expect(wb.SheetNames).toEqual(["Summary", "Walls", "Panel Schedule", "Track & Flashing", "Fixings & Sealant"]);
  });

  it("adds a Connections sheet when connections are present", () => {
    const wb = buildWorkbook(baseReport({
      connections: [{ wallA: "Wall 1 (vertical)", wallB: "Wall 2 (horizontal)", lengthM: 3, quantity: 2, stock: 6, pieces: 1, reason: "test", warnings: [] }],
    }));
    expect(wb.SheetNames).toContain("Connections");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Connections"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Wall A"]).toBe("Wall 1 (vertical)");
    expect(rows[0]["Pieces"]).toBe(1);
  });

  it("includes wall list, panel schedule and fixings data in their respective sheets", () => {
    const wb = buildWorkbook(baseReport());

    const wallRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Walls"]);
    expect(wallRows).toHaveLength(1);
    expect(wallRows[0]["Wall"]).toBe("Wall 1");
    expect(wallRows[0]["Area"]).toBe("9 m2");

    const panelRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Panel Schedule"]);
    expect(panelRows).toHaveLength(1);
    expect(panelRows[0]["Ordered"]).toBe(21);

    const fixRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Fixings & Sealant"]);
    const sealantRow = fixRows.find(r => String(r["Item"]).includes("sausages"));
    expect(sealantRow?.["Quantity"]).toBe(3);
  });

  it("placeholders an empty panel schedule instead of writing a blank sheet", () => {
    const wb = buildWorkbook(baseReport({ panelGroups: [], customPanels: [] }));
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Panel Schedule"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Length"]).toBe("No panels");
  });

  it("carries summary totals and warnings through to the Summary sheet", () => {
    const wb = buildWorkbook(baseReport({ warnings: ["Some warning"] }));
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Summary"], { header: 1 });
    const flat = rows.map(r => r.join("|")).join("\n");
    expect(flat).toContain("Total area (m2)|12.34");
    expect(flat).toContain("Some warning");
  });
});
