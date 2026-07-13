// =============================================================================
// applyEffectivePricing -- merge a company's assigned price list (+ PL1
// fallback) onto the product catalog before pricing an estimate
// =============================================================================
// Client-side merge, not a server-side "effective catalog" RPC -- extends
// the existing "fetch whole catalog once, pure-function match" shape
// priceEstimateReportData.ts already uses rather than replacing it.
// Resolution order per confirmed product decision: the company's own
// assigned list wins, then PL1 - Standard (protects against a forgotten SKU
// on a duplicated list silently going unpriced for one customer), then
// whatever the deprecated panels/tracks/fixings/sealants.price_per_* value
// already on the catalog item was (covers a brand-new environment with no
// price_list_prices rows at all). priceReportData() itself needs zero
// changes -- it keeps reading catalog.panels.find(...).pricePerPanel exactly
// as before, unaware price lists exist.
// =============================================================================
import type { ProductCatalog } from "../pages/admin/products/productTypes";
import { priceRowProductId, type PriceListPriceRow, type PriceableCategory } from "../pages/admin/priceLists/priceListTypes";

function buildPriceMap(rows: PriceListPriceRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(`${row.category}:${priceRowProductId(row)}`, row.price);
  return map;
}

export function applyEffectivePricing(
  catalog: ProductCatalog,
  assignedListRows: PriceListPriceRow[],
  defaultListRows: PriceListPriceRow[],
): ProductCatalog {
  const assigned = buildPriceMap(assignedListRows);
  const fallback = buildPriceMap(defaultListRows);
  const resolve = (category: PriceableCategory, id: string, existing: number | undefined): number | undefined =>
    assigned.get(`${category}:${id}`) ?? fallback.get(`${category}:${id}`) ?? existing;

  return {
    ...catalog,
    panels: catalog.panels.map(p => ({ ...p, pricePerPanel: resolve("panel", p.id, p.pricePerPanel) })),
    tracks: catalog.tracks.map(t => ({ ...t, pricePerMetre: resolve("track", t.id, t.pricePerMetre) })),
    fixings: catalog.fixings.map(f => ({ ...f, pricePerBox: resolve("fixing", f.id, f.pricePerBox) })),
    sealants: catalog.sealants.map(s => ({ ...s, pricePerBox: resolve("sealant", s.id, s.pricePerBox) })),
  };
}
