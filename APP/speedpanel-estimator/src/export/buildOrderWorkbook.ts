// =============================================================================
// buildOrderWorkbook
// =============================================================================
// Pure function: OrderRow + its deliveries -> XLSX workbook, same "no React,
// no DOM" convention as buildWorkbook.ts. This is what the pro forma invoice
// page exports instead of a printable/PDF view -- the on-screen page stays
// as a preview, this is the "how do I get a file out of this" mechanism.
//
// xlsx is dynamically imported, not a top-level `import * as XLSX` -- see
// buildWorkbook.ts's header comment for why.
// =============================================================================
import type * as XLSXType from "xlsx";
import type { OrderRow, OrderDeliveryRow } from "../pages/projects/orders/orderTypes";

function autoWidth(rows: (string | number)[][]): { wch: number }[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length;
      widths[i] = Math.max(widths[i] || 8, Math.min(len + 2, 60));
    });
  }
  return widths.map(wch => ({ wch }));
}

function sheetFromRows(XLSX: typeof XLSXType, header: string[], rows: (string | number)[][]): XLSXType.WorkSheet {
  const aoa = [header, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoWidth(aoa);
  ws["!views"] = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

const formatAddress = (d: OrderDeliveryRow): string =>
  [d.address_line1, d.address_line2, `${d.suburb} ${d.state} ${d.postcode}`].filter(Boolean).join(", ");

export async function buildOrderWorkbook(order: OrderRow, deliveries: OrderDeliveryRow[], projectName: string): Promise<XLSXType.WorkBook> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const orderRef = order.id.slice(0, 8).toUpperCase();

  // --- Pro Forma Invoice -------------------------------------------------------
  const summaryRows: (string | number)[][] = [
    ["Report", "Speedpanel pro forma invoice"],
    ["Order ref", orderRef],
    ["Project", projectName],
    ["Issued", order.proforma_issued_at ? new Date(order.proforma_issued_at).toLocaleString() : ""],
    ["", ""],
    ["Subtotal (ex GST)", order.subtotal_ex_gst],
    [`GST (${(order.gst_rate * 100).toFixed(0)}%)`, order.gst_amount],
    ["Total (inc GST)", order.total_inc_gst],
  ];
  if (order.unpriced_item_count > 0) {
    summaryRows.push(["", ""], ["Note", `${order.unpriced_item_count} item(s) couldn't be priced automatically -- see Line Items`]);
  }
  summaryRows.push(
    ["", ""],
    ["Disclaimer", "This is a pro forma invoice for planning purposes only and does not constitute a tax invoice. Pricing for any unconfirmed item will be provided separately before dispatch."],
  );
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs["!cols"] = autoWidth(summaryRows);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Pro Forma Invoice");

  // --- Line Items ----------------------------------------------------------------
  const itemHeader = ["Item", "Qty", "Unit", "Unit price (ex GST)", "Total (ex GST)", "Matched"];
  const itemRows = order.line_items.map(i => [
    i.label, i.qty, i.unit, i.unitPriceExGst ?? "To be confirmed", i.lineTotalExGst, i.matched ? "Yes" : "No",
  ]);
  if (itemRows.length === 0) itemRows.push(["No line items", 0, "", "", 0, ""]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, itemHeader, itemRows), "Line Items");

  // --- Delivery Schedule -----------------------------------------------------------
  // Flat, one row per (delivery, allocated item) pair -- same "flatten a
  // many-to-one relation" precedent as buildWorkbook.ts's Connections sheet.
  const deliveryHeader = ["Delivery #", "Address", "Requested date", "Contact", "Item", "Qty"];
  const itemLabelById = Object.fromEntries(order.line_items.map(i => [i.id, i.label]));
  const deliveryRows: (string | number)[][] = [];
  for (const d of deliveries) {
    const address = formatAddress(d);
    const requestedDate = d.requested_date ? new Date(d.requested_date).toLocaleDateString() : "";
    const contact = [d.contact_name, d.contact_phone].filter(Boolean).join(" / ");
    if (d.item_allocations.length === 0) {
      deliveryRows.push([d.sequence_no, address, requestedDate, contact, "", 0]);
    } else {
      for (const a of d.item_allocations) {
        deliveryRows.push([d.sequence_no, address, requestedDate, contact, itemLabelById[a.lineItemId] ?? a.lineItemId, a.qty]);
      }
    }
  }
  if (deliveryRows.length === 0) deliveryRows.push(["--", "No deliveries", "", "", "", 0]);
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, deliveryHeader, deliveryRows), "Delivery Schedule");

  return wb;
}
