import { describe, it, expect } from "vitest";
import { buildPriceListCsvRows, parsePriceListCsv } from "./priceListCsv";
import type { ProductCatalog } from "../products/productTypes";
import type { PriceListPriceRow } from "./priceListTypes";

function baseCatalog(): ProductCatalog {
  return {
    panels: [{ id: "p51", type: 51, label: "P51", pricePerPanel: 100 } as ProductCatalog["panels"][number]],
    tracks: [{ id: "t1", label: "C-track", pricePerMetre: 10 } as ProductCatalog["tracks"][number]],
    fixings: [],
    sealants: [],
    colours: [],
  };
}

function priceRow(overrides: Partial<PriceListPriceRow>): PriceListPriceRow {
  return {
    id: "row-1", price_list_version_id: "plv-1", category: "panel",
    panel_id: null, track_id: null, fixing_id: null, sealant_id: null,
    price: 0, created_at: "2026-01-01", updated_at: "2026-01-01",
    ...overrides,
  };
}

describe("buildPriceListCsvRows", () => {
  it("includes every catalog product, priced or not", () => {
    const rows = buildPriceListCsvRows(baseCatalog(), [priceRow({ category: "panel", panel_id: "p51", price: 123.45 })]);
    expect(rows).toHaveLength(2);
    expect(rows.find(r => r.productId === "p51")).toMatchObject({ category: "panel", price: 123.45 });
    expect(rows.find(r => r.productId === "t1")).toMatchObject({ category: "track", price: null });
  });
});

describe("parsePriceListCsv", () => {
  const toFile = (csv: string) => new File([csv], "prices.csv", { type: "text/csv" });

  it("parses valid rows and skips blank/unreadable prices and unknown categories", async () => {
    const csv = [
      "Category,Product ID,Product,Price",
      "Panels,p51,P51,123.45",
      "Tracks,t1,C-track,",
      "Widgets,w1,Widget,5",
      "Panels,,No id,10",
    ].join("\n");
    const result = await parsePriceListCsv(toFile(csv));
    expect(result.missingColumns).toBe(false);
    expect(result.rows).toEqual([{ category: "panel", productId: "p51", price: 123.45 }]);
    expect(result.skipped).toBe(2); // blank price + missing product id
    expect(result.unknownCategories).toBe(1); // "Widgets"
  });

  it("flags missing required columns", async () => {
    const csv = ["Name,Price", "P51,10"].join("\n");
    const result = await parsePriceListCsv(toFile(csv));
    expect(result.missingColumns).toBe(true);
    expect(result.rows).toHaveLength(0);
  });

  it("matches header case-insensitively regardless of column order", async () => {
    const csv = ["price,PRODUCT id,category", "50,t1,tracks"].join("\n");
    const result = await parsePriceListCsv(toFile(csv));
    expect(result.rows).toEqual([{ category: "track", productId: "t1", price: 50 }]);
  });
});
