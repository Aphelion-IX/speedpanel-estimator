import { describe, it, expect } from "vitest";
import { applyEffectivePricing } from "./applyEffectivePricing";
import type { ProductCatalog } from "../pages/admin/products/productTypes";
import type { PriceListPriceRow } from "../pages/admin/priceLists/priceListTypes";

function baseCatalog(): ProductCatalog {
  return {
    panels: [{ id: "panel-1", type: 51, label: "P51", depth: "", frl: "", pack: 0, ctrackStock: 0, ctrackDim: "", jtrackDim: "", maxHVert: 0, maxHHoriz: 0, spanVert: { maxW: "", maxH: "" }, spanHoriz: [], cornerPost: [], horizCtrack: [], pricePerPanel: 40, createdAt: "", updatedAt: "" } as never],
    tracks: [{ id: "track-1", kind: "c-track", system: "internal", label: "C-track", dim: "", stockLengths: [], pricePerMetre: 10, createdAt: "", updatedAt: "" } as never],
    fixings: [{ id: "fixing-1", code: "F30", gauge: "", lengthMm: 30, use: "", perBox: 100, pricePerBox: 5, createdAt: "", updatedAt: "" } as never],
    sealants: [{ id: "sealant-1", system: "internal", product: "Sealant", m2PerSausage: 1, perBox: 1, pricePerBox: 8, createdAt: "", updatedAt: "" } as never],
    colours: [],
  };
}

function priceRow(overrides: Partial<PriceListPriceRow>): PriceListPriceRow {
  return {
    id: "row-1", price_list_id: "pl-1", category: "panel",
    panel_id: null, track_id: null, fixing_id: null, sealant_id: null,
    price: 0, created_at: "", updated_at: "",
    ...overrides,
  };
}

describe("applyEffectivePricing", () => {
  it("prefers the company's assigned list over PL1 and the deprecated column", () => {
    const catalog = baseCatalog();
    const assigned = [priceRow({ id: "a1", category: "panel", panel_id: "panel-1", price: 55 })];
    const defaultList = [priceRow({ id: "d1", category: "panel", panel_id: "panel-1", price: 45 })];
    const result = applyEffectivePricing(catalog, assigned, defaultList);
    expect(result.panels[0].pricePerPanel).toBe(55);
  });

  it("falls back to PL1 when the assigned list has no row for a product", () => {
    const catalog = baseCatalog();
    const defaultList = [priceRow({ id: "d1", category: "track", track_id: "track-1", price: 12 })];
    const result = applyEffectivePricing(catalog, [], defaultList);
    expect(result.tracks[0].pricePerMetre).toBe(12);
  });

  it("falls back to the deprecated price_per_* column when neither list has a row", () => {
    const catalog = baseCatalog();
    const result = applyEffectivePricing(catalog, [], []);
    expect(result.fixings[0].pricePerBox).toBe(5);
    expect(result.sealants[0].pricePerBox).toBe(8);
  });

  it("only matches within the same category, never across panel/track/fixing/sealant", () => {
    const catalog = baseCatalog();
    // A row with the SAME id as panel-1 but tagged as a different category
    // must not leak into panels' resolution.
    const assigned = [priceRow({ id: "a1", category: "track", track_id: "panel-1", price: 999 })];
    const result = applyEffectivePricing(catalog, assigned, []);
    expect(result.panels[0].pricePerPanel).toBe(40);
  });
});
