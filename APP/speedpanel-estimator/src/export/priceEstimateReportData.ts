// =============================================================================
// priceEstimateReportData -- match EstimateReportData line items against the
// priced product catalog, and compute Order totals (subtotal + GST)
// =============================================================================
// The Admin Products catalog is decoupled from the live compute engine (see
// productTypes.ts's own header comment), so there's no foreign key from a
// computed line item back to a catalog row -- matching happens by BUSINESS
// KEY instead (panel type; track kind+system+panelType), using the fields
// reportTypes.ts's PanelGroupRow/TrackLineRow extension added for exactly
// this purpose. Fixings/sealant are matched by length_mm (30/16) and system
// respectively -- safe only because today's seed data has exactly one row
// per bucket (a data-hygiene convention for admins to maintain, not a schema
// constraint -- see productTypes.ts).
//
// A line item that can't be matched to a priced catalog row is NOT silently
// treated as $0 -- `matched: false` and a $0 lineTotalExGst are both kept
// visible so the Orders UI can surface "N items couldn't be priced
// automatically" rather than hiding the gap.
// =============================================================================
import { z } from "zod";
import type { EstimateReportData } from "./reportTypes";
import type { ProductCatalog } from "../pages/admin/products/productTypes";

export const GST_RATE = 0.10;

export const ORDER_LINE_ITEM_CATEGORIES = ["panel", "custom_panel", "track", "fixing", "sealant"] as const;
export type OrderLineItemCategory = typeof ORDER_LINE_ITEM_CATEGORIES[number];
export const ORDER_LINE_ITEM_UNITS = ["panel", "metre", "box"] as const;
export type OrderLineItemUnit = typeof ORDER_LINE_ITEM_UNITS[number];

// A Zod schema (not a plain interface) since this is also what
// orders.line_items validates on the way back out of Supabase (see
// src/pages/projects/orders/orderTypes.ts) -- same "row shapes are Zod so a
// read can be validated" convention as every other Supabase-backed type in
// this codebase.
export const OrderLineItemSchema = z.object({
  id: z.string(),
  category: z.enum(ORDER_LINE_ITEM_CATEGORIES),
  label: z.string(),
  qty: z.number(),
  unit: z.enum(ORDER_LINE_ITEM_UNITS),
  unitPriceExGst: z.number().nullable(),
  lineTotalExGst: z.number(),
  matched: z.boolean(),
});
export type OrderLineItem = z.infer<typeof OrderLineItemSchema>;

export interface PricedReport {
  items: OrderLineItem[];
  unpricedCount: number;
  subtotalExGst: number;
  gstRate: number;
  gstAmount: number;
  totalIncGst: number;
}

// Exported so the Order builder UI can recompute a line total the same way
// after a customer edits a line item's quantity (see OrderLineItemsTable.tsx).
export const round2 = (n: number): number => Math.round(n * 100) / 100;

function makeItem(
  category: OrderLineItemCategory, label: string, qty: number, unit: OrderLineItemUnit, unitPrice: number | null,
): OrderLineItem {
  const matched = unitPrice != null;
  return {
    id: crypto.randomUUID(), category, label, qty, unit,
    unitPriceExGst: unitPrice, lineTotalExGst: matched ? round2(unitPrice! * qty) : 0, matched,
  };
}

export function priceReportData(report: EstimateReportData, catalog: ProductCatalog): PricedReport {
  const items: OrderLineItem[] = [];

  for (const g of report.panelGroups) {
    const panel = catalog.panels.find(p => p.type === g.panelType);
    items.push(makeItem("panel", g.label, g.ordered, "panel", panel?.pricePerPanel ?? null));
  }
  for (const g of report.customPanels) {
    const panel = catalog.panels.find(p => p.type === g.panelType);
    items.push(makeItem("custom_panel", g.label, g.ordered, "panel", panel?.pricePerPanel ?? null));
  }
  for (const t of report.trackLines) {
    let unitPrice: number | null = null;
    if (t.kind && t.system) {
      const track = catalog.tracks.find(tr =>
        tr.kind === t.kind
        && (tr.system === t.system || tr.system === "both")
        && (t.panelType == null || tr.panelType == null || tr.panelType === t.panelType));
      unitPrice = track?.pricePerMetre ?? null;
    }
    items.push(makeItem("track", t.label, t.lengthM, "metre", unitPrice));
  }
  if (report.fixings.boxes30 > 0) {
    const fixing30 = catalog.fixings.find(f => f.lengthMm === 30);
    items.push(makeItem("fixing", "Fixings - 30 mm", report.fixings.boxes30, "box", fixing30?.pricePerBox ?? null));
  }
  if (report.fixings.boxes16 > 0) {
    const fixing16 = catalog.fixings.find(f => f.lengthMm === 16);
    items.push(makeItem("fixing", "Fixings - 16 mm", report.fixings.boxes16, "box", fixing16?.pricePerBox ?? null));
  }
  if (report.fixings.sealantLines && report.fixings.sealantLines.length > 0) {
    // A mixed Internal+External project uses two genuinely different
    // sealant products (see reportTypes.ts's SealantLine) -- price each
    // side's line separately rather than the single sealantLabel/
    // sealantBoxes pair below, which can only ever represent one of them.
    for (const line of report.fixings.sealantLines) {
      const sealant = catalog.sealants.find(s => s.system === line.system);
      items.push(makeItem("sealant", line.label, line.boxes, "box", sealant?.pricePerBox ?? null));
    }
  } else if (report.fixings.sealantBoxes > 0) {
    // reportTypes.ts's fixings summary doesn't carry a system field directly --
    // systemLabel ("Internal calculator - ..." / "External calculator - ...")
    // is the one place this report already records which system it's for.
    const system = report.systemLabel.startsWith("Internal") ? "internal" : "external";
    const sealant = catalog.sealants.find(s => s.system === system);
    items.push(makeItem("sealant", report.fixings.sealantLabel, report.fixings.sealantBoxes, "box", sealant?.pricePerBox ?? null));
  }

  const unpricedCount = items.filter(i => !i.matched).length;
  const subtotalExGst = round2(items.reduce((sum, i) => sum + i.lineTotalExGst, 0));
  const gstAmount = round2(subtotalExGst * GST_RATE);
  const totalIncGst = round2(subtotalExGst + gstAmount);

  return { items, unpricedCount, subtotalExGst, gstRate: GST_RATE, gstAmount, totalIncGst };
}
