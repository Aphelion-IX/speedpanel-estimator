// =============================================================================
// Price list CSV import/export
// =============================================================================
// Round-trips a price list's prices as a plain CSV: Category, Product ID,
// Product, Price. Product ID is the stable match key on import (the same id
// CATEGORY_KEY[category] catalog lookups already key on) -- Product is
// informational only, ignored on import, so renaming a product in the
// catalog can't silently break re-import of a previously exported file.
//
// Reuses the xlsx package (already a dependency, see export/buildWorkbook.ts)
// for both directions instead of hand-rolling a CSV parser/writer --
// XLSX.utils.aoa_to_sheet/writeFile(..., {bookType:"csv"}) and XLSX.read
// already handle quoting/escaping (product names containing commas, etc.)
// correctly, and it's a dynamic import so it doesn't add to the main bundle
// unless this page is actually visited.
// =============================================================================
import { CATEGORY_KEY, CATEGORY_LABEL, type ProductCatalog } from "../products/productTypes";
import { itemTitle } from "../products/productCategoryViews";
import type { ProductItem } from "../products/productCard";
import { PRICEABLE_CATEGORIES, priceRowProductId, type PriceableCategory, type PriceListPriceRow } from "./priceListTypes";

export interface PriceListCsvRow { category: PriceableCategory; productId: string; label: string; price: number | null; }

// One row per priceable catalog product (not just the ones already priced
// on this list) -- an unpriced product still needs a row so exporting,
// filling in a price in a spreadsheet, and re-importing is a real round trip
// instead of only ever being able to edit what's already set.
export function buildPriceListCsvRows(catalog: ProductCatalog, prices: PriceListPriceRow[]): PriceListCsvRow[] {
  const priceByKey = new Map<string, number>();
  for (const row of prices) priceByKey.set(`${row.category}:${priceRowProductId(row)}`, row.price);

  const rows: PriceListCsvRow[] = [];
  for (const category of PRICEABLE_CATEGORIES) {
    const items = catalog[CATEGORY_KEY[category]] as ProductItem[];
    for (const item of items) {
      rows.push({ category, productId: item.id, label: itemTitle(category, item), price: priceByKey.get(`${category}:${item.id}`) ?? null });
    }
  }
  return rows;
}

function slugify(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "price-list";
}

export async function exportPriceListCsv(name: string, rows: PriceListCsvRow[]): Promise<void> {
  const XLSX = await import("xlsx");
  const aoa = [
    ["Category", "Product ID", "Product", "Price"],
    ...rows.map(r => [CATEGORY_LABEL[r.category], r.productId, r.label, r.price ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Prices");
  XLSX.writeFile(wb, `${slugify(name)}-prices.csv`, { bookType: "csv" });
}

export interface ParsedImportRow { category: PriceableCategory; productId: string; price: number; }
export interface ImportParseResult { rows: ParsedImportRow[]; skipped: number; unknownCategories: number; missingColumns: boolean; }

const CATEGORY_BY_LABEL = new Map(PRICEABLE_CATEGORIES.map(c => [CATEGORY_LABEL[c].toLowerCase(), c]));

// Rows with a blank/unparsable price are skipped, not treated as "clear this
// price" -- a spreadsheet with mostly-blank cells (the common case, since
// export includes every catalog product) shouldn't wipe out existing prices
// just because the user didn't touch those rows. Use the existing per-row
// Clear button in the UI to explicitly remove a price instead.
export async function parsePriceListCsv(file: File): Promise<ImportParseResult> {
  const XLSX = await import("xlsx");
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][];

  const [header, ...body] = aoa;
  if (!header) return { rows: [], skipped: 0, unknownCategories: 0, missingColumns: true };

  // Column order isn't assumed -- match header text case-insensitively so a
  // re-arranged or re-saved (Excel/Sheets, which may reorder/rename slightly
  // differently) file still imports correctly.
  const headerRow = header.map(h => String(h).trim().toLowerCase());
  const idx = {
    category: headerRow.indexOf("category"),
    productId: headerRow.indexOf("product id"),
    price: headerRow.indexOf("price"),
  };
  if (idx.category === -1 || idx.productId === -1 || idx.price === -1) {
    return { rows: [], skipped: 0, unknownCategories: 0, missingColumns: true };
  }

  const rows: ParsedImportRow[] = [];
  let skipped = 0, unknownCategories = 0;
  for (const line of body) {
    const rawCategory = String(line[idx.category] ?? "").trim().toLowerCase();
    const productId = String(line[idx.productId] ?? "").trim();
    const rawPrice = line[idx.price];
    const category = CATEGORY_BY_LABEL.get(rawCategory);
    if (!category) { if (rawCategory) unknownCategories++; continue; }
    if (!productId) { skipped++; continue; }
    const price = typeof rawPrice === "number" ? rawPrice : Number(String(rawPrice ?? "").trim());
    if (rawPrice === "" || rawPrice == null || Number.isNaN(price)) { skipped++; continue; }
    rows.push({ category, productId, price });
  }
  return { rows, skipped, unknownCategories, missingColumns: false };
}
