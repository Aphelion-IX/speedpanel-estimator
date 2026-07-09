import { describe, it, expect } from "vitest";
import { priceReportData } from "./priceEstimateReportData";
import type { EstimateReportData } from "./reportTypes";
import type { ProductCatalog } from "../pages/admin/products/productTypes";

const emptyCatalog: ProductCatalog = { panels: [], tracks: [], fixings: [], sealants: [], colours: [] };

function baseReport(overrides: Partial<EstimateReportData> = {}): EstimateReportData {
  return {
    systemLabel: "Internal calculator - Vertical", modeLabel: "Project", generatedAt: new Date(),
    totals: { area: 10, panels: 5 },
    walls: [], panelGroups: [], customPanels: [], trackLines: [],
    fixings: { fix30: 0, boxes30: 0, fix16: 0, boxes16: 0, sealantLabel: "Sealant", sealantBoxes: 0, sausages: 0, area: 0 },
    connections: [], notes: [], warnings: [],
    ...overrides,
  };
}

const catalogStub = (overrides: Partial<ProductCatalog> = {}): ProductCatalog => ({ ...emptyCatalog, ...overrides });

describe("priceReportData", () => {
  it("prices a matched panel line item and computes GST correctly", () => {
    const report = baseReport({
      panelGroups: [{ label: "P51 - 3.0 m", status: "Stocked", required: 10, packSize: 21, packs: 1, ordered: 21, spare: 11, panelType: 51 }],
    });
    const catalog = catalogStub({
      panels: [{ id: "p1", createdAt: "", updatedAt: "", type: 51, label: "P51", depth: "", frl: "", pack: 21,
        ctrackStock: 6, ctrackDim: "", jtrackDim: "", maxHVert: 6, maxHHoriz: 6,
        spanVert: { maxW: "", maxH: "" }, spanHoriz: [], cornerPost: [], horizCtrack: [], pricePerPanel: 40 }],
    });

    const priced = priceReportData(report, catalog);
    expect(priced.items).toHaveLength(1);
    expect(priced.items[0]).toMatchObject({ category: "panel", qty: 21, unit: "panel", unitPriceExGst: 40, lineTotalExGst: 840, matched: true });
    expect(priced.unpricedCount).toBe(0);
    expect(priced.subtotalExGst).toBe(840);
    expect(priced.gstAmount).toBe(84);
    expect(priced.totalIncGst).toBe(924);
  });

  it("leaves an unmatched panel (no catalog price set) flagged rather than silently $0-and-hidden", () => {
    const report = baseReport({
      panelGroups: [{ label: "P64 - 3.0 m", status: "Stocked", required: 5, packSize: 14, packs: 1, ordered: 14, spare: 9, panelType: 64 }],
    });
    const priced = priceReportData(report, emptyCatalog);
    expect(priced.items).toHaveLength(1);
    expect(priced.items[0]).toMatchObject({ matched: false, unitPriceExGst: null, lineTotalExGst: 0 });
    expect(priced.unpricedCount).toBe(1);
    expect(priced.subtotalExGst).toBe(0);
  });

  it("matches a track line only when kind+system+panelType all line up, and skips lines with no kind at all", () => {
    const report = baseReport({
      trackLines: [
        { label: "C-track vert P78", pieces: 4, lengthM: 12, stockLabel: "", kind: "c-track", system: "internal", panelType: 78 },
        { label: "Corner posts (linked pairs)", pieces: 2, lengthM: 6, stockLabel: "" }, // no kind -- no TrackKind mapping exists
      ],
    });
    const catalog = catalogStub({
      tracks: [{ id: "t1", createdAt: "", updatedAt: "", kind: "c-track", system: "internal", label: "", dim: "", stockLengths: [], panelType: 78, pricePerMetre: 10 }],
    });
    const priced = priceReportData(report, catalog);
    expect(priced.items).toHaveLength(2);
    expect(priced.items[0]).toMatchObject({ matched: true, unitPriceExGst: 10, lineTotalExGst: 120 });
    expect(priced.items[1]).toMatchObject({ matched: false, unitPriceExGst: null });
    expect(priced.unpricedCount).toBe(1);
  });

  it("matches a track catalog row with system 'both' against either internal or external report lines", () => {
    const report = baseReport({
      trackLines: [{ label: "J-track", pieces: 1, lengthM: 5, stockLabel: "", kind: "j-track", system: "external", panelType: 78 }],
    });
    const catalog = catalogStub({
      tracks: [{ id: "t1", createdAt: "", updatedAt: "", kind: "j-track", system: "both", label: "", dim: "", stockLengths: [], panelType: 78, pricePerMetre: 8 }],
    });
    const priced = priceReportData(report, catalog);
    expect(priced.items[0]).toMatchObject({ matched: true, unitPriceExGst: 8, lineTotalExGst: 40 });
  });

  it("prices fixings by length_mm bucket and sealant by system inferred from systemLabel", () => {
    const report = baseReport({
      systemLabel: "External calculator - Vertical",
      fixings: { fix30: 100, boxes30: 2, fix16: 0, boxes16: 0, sealantLabel: "Sikaflex 400 Fire PU", sealantBoxes: 3, sausages: 12, area: 10 },
    });
    const catalog = catalogStub({
      fixings: [{ id: "f1", createdAt: "", updatedAt: "", code: "10g-30", gauge: "10g", lengthMm: 30, use: "", perBox: 1000, pricePerBox: 50 }],
      sealants: [{ id: "s1", createdAt: "", updatedAt: "", system: "external", product: "Sikaflex", m2PerSausage: 4, perBox: 20, pricePerBox: 200 }],
    });
    const priced = priceReportData(report, catalog);
    const fixing = priced.items.find(i => i.category === "fixing")!;
    const sealant = priced.items.find(i => i.category === "sealant")!;
    expect(fixing).toMatchObject({ qty: 2, unitPriceExGst: 50, lineTotalExGst: 100, matched: true });
    expect(sealant).toMatchObject({ qty: 3, unitPriceExGst: 200, lineTotalExGst: 600, matched: true });
  });
});
