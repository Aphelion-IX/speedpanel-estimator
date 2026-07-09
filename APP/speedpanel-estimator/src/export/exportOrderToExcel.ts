// =============================================================================
// exportOrderToExcel
// =============================================================================
// The one side-effecting call site for the pro forma invoice's Excel export,
// same shape as exportEstimateToExcel.ts.
// =============================================================================
import * as XLSX from "xlsx";
import { buildOrderWorkbook } from "./buildOrderWorkbook";
import type { OrderRow, OrderDeliveryRow } from "../pages/projects/orders/orderTypes";

export function exportOrderToExcel(order: OrderRow, deliveries: OrderDeliveryRow[], projectName: string): void {
  const wb = buildOrderWorkbook(order, deliveries, projectName);
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Speedpanel-Proforma-${orderRef}-${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}
