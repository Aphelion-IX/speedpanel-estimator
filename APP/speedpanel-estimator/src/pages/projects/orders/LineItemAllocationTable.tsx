// =============================================================================
// Per-delivery line-item allocation table
// =============================================================================
// One fixed row per order line item (never added/removed here -- the row set
// is the order's own line items), qty capped at what's still unallocated
// across every OTHER delivery batch on this order. Read-only mode (used on
// an already-created delivery) just displays the allocation, no inputs.
// =============================================================================
import { NAVY, MUTED } from "../../../styleTokens";
import { Table, type TableColumn } from "../../../ui/table";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";

export const LineItemAllocationTable = ({ items, remaining, allocations, onChange, readOnly }: {
  items: OrderLineItem[];
  remaining: Record<string, number>;
  allocations: Record<string, number>;
  onChange?: (lineItemId: string, qty: number) => void;
  readOnly?: boolean;
}) => {
  const visible = items.filter(i => (allocations[i.id] ?? 0) > 0 || (remaining[i.id] ?? 0) > 0);
  if (visible.length === 0) {
    return <p className="text-sm" style={{ color: MUTED }}>Nothing left to allocate to another delivery.</p>;
  }

  const columns: TableColumn<OrderLineItem>[] = [
    { key: "item", header: "Item", cell: item => <span style={{ color: NAVY }}>{item.label}</span> },
    ...(!readOnly ? [{
      key: "remaining",
      header: "Remaining",
      align: "right" as const,
      cell: (item: OrderLineItem) => <span style={{ color: MUTED }}>{remaining[item.id] ?? 0} {item.unit}</span>,
    }] : []),
    {
      key: "allocate",
      header: readOnly ? "Qty" : "Allocate",
      align: "right",
      cell: item => {
        const qty = allocations[item.id] ?? 0;
        const max = remaining[item.id] ?? 0;
        return readOnly ? (
          <span style={{ color: NAVY }}>{qty} {item.unit}</span>
        ) : (
          <input type="number" min={0} max={max} value={qty}
            onChange={e => onChange?.(item.id, Math.max(0, Math.min(Number(e.target.value), max)))}
            className="w-20 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
        );
      },
    },
  ];

  return <Table columns={columns} rows={visible} rowKey={item => item.id} />;
};
