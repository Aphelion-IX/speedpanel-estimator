// =============================================================================
// exportOrderToExcel
// =============================================================================
// The one side-effecting call site for the pro forma invoice's Excel export,
// same shape as exportEstimateToExcel.ts.
// =============================================================================
import { buildOrderWorkbook } from "./buildOrderWorkbook";
import type { OrderRow, OrderDeliveryRow } from "../pages/projects/orders/orderTypes";
import type { OrderAdjustmentRow } from "../pages/projects/orders/orderAdjustmentTypes";

export async function exportOrderToExcel(
  order: OrderRow, deliveries: OrderDeliveryRow[], projectName: string, adjustments: OrderAdjustmentRow[] = [],
): Promise<void> {
  const [wb, XLSX] = await Promise.all([buildOrderWorkbook(order, deliveries, projectName, adjustments), import("xlsx")]);
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Speedpanel-Proforma-${orderRef}-${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}
