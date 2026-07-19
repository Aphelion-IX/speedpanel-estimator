import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildOrderWorkbook } from "./buildOrderWorkbook";
import type { OrderRow, OrderDeliveryRow } from "../pages/projects/orders/orderTypes";

function baseOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    project_id: "p1", owner_id: "u1", stage: "proforma_issued",
    line_items: [
      { id: "li1", category: "panel", label: "P51 - 3.0 m", qty: 21, unit: "panel", unitPriceExGst: 40, lineTotalExGst: 840, matched: true },
      { id: "li2", category: "track", label: "Corner posts", qty: 6, unit: "metre", unitPriceExGst: null, lineTotalExGst: 0, matched: false },
    ],
    subtotal_ex_gst: 840, gst_rate: 0.10, gst_amount: 84, total_inc_gst: 924,
    unpriced_item_count: 1, customer_note: null,
    submitted_at: "2026-01-01T00:00:00.000Z", proforma_requested_at: "2026-01-02T00:00:00.000Z",
    proforma_issued_at: "2026-01-03T00:00:00.000Z", cancelled_at: null,
    panels_manufactured: null, manufacturing_est_completion: null,
    company_id: null,
    order_number: null, order_kind: "standard", source_order_id: null,
    purchase_order_reference: null, customer_required_date: null,
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

function baseDelivery(overrides: Partial<OrderDeliveryRow> = {}): OrderDeliveryRow {
  return {
    id: "d1", order_id: "o1", sequence_no: 1,
    address_line1: "1 Example St", address_line2: null, suburb: "Sydney", state: "NSW", postcode: "2000",
    requested_date: "2026-02-01", proposed_date: null, confirmed_date: null, actual_date: null,
    contact_name: "Jane", contact_phone: "0400000000", delivery_instructions: null,
    preferred_window: null, site_access_details: null, customer_note: null,
    item_allocations: [{ lineItemId: "li1", qty: 21 }],
    status: "planned", approval_status: "accepted",
    created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildOrderWorkbook", () => {
  it("builds all three sheets with the expected names", async () => {
    const wb = await buildOrderWorkbook(baseOrder(), [baseDelivery()], "Test Project");
    expect(wb.SheetNames).toEqual(["Pro Forma Invoice", "Line Items", "Delivery Schedule"]);
  });

  it("includes order totals and project name in the Pro Forma Invoice sheet", async () => {
    const wb = await buildOrderWorkbook(baseOrder(), [baseDelivery()], "Test Project");
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Pro Forma Invoice"], { header: 1 });
    const flat = rows.map(r => r.join("|")).join("\n");
    expect(flat).toContain("Test Project");
    expect(flat).toContain("924");
  });

  it("marks an unmatched line item as unmatched with no unit price", async () => {
    const wb = await buildOrderWorkbook(baseOrder(), [baseDelivery()], "Test Project");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Line Items"]);
    const unmatched = rows.find(r => r["Item"] === "Corner posts");
    expect(unmatched?.["Matched"]).toBe("No");
    expect(unmatched?.["Unit price (ex GST)"]).toBe("To be confirmed");
    const matched = rows.find(r => r["Item"] === "P51 - 3.0 m");
    expect(matched?.["Matched"]).toBe("Yes");
    expect(matched?.["Total (ex GST)"]).toBe(840);
  });

  it("flattens delivery item allocations into one row per (delivery, item) pair", async () => {
    const deliveries = [
      baseDelivery({ id: "d1", sequence_no: 1, item_allocations: [{ lineItemId: "li1", qty: 15 }] }),
      baseDelivery({ id: "d2", sequence_no: 2, item_allocations: [{ lineItemId: "li1", qty: 6 }, { lineItemId: "li2", qty: 6 }] }),
    ];
    const wb = await buildOrderWorkbook(baseOrder(), deliveries, "Test Project");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Delivery Schedule"]);
    expect(rows).toHaveLength(3);
    expect(rows.filter(r => r["Delivery #"] === 2)).toHaveLength(2);
    expect(rows.find(r => r["Item"] === "Corner posts")?.["Qty"]).toBe(6);
  });

  it("placeholders an empty delivery schedule instead of writing a blank sheet", async () => {
    const wb = await buildOrderWorkbook(baseOrder(), [], "Test Project");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Delivery Schedule"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Address"]).toBe("No deliveries");
  });
});
