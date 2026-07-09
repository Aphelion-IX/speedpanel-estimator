// =============================================================================
// Per-delivery line-item allocation table (bespoke, not RepeatableRowEditor)
// =============================================================================
// One fixed row per order line item (never added/removed here -- the row set
// is the order's own line items), qty capped at what's still unallocated
// across every OTHER delivery batch on this order. Read-only mode (used on
// an already-created delivery) just displays the allocation, no inputs.
// =============================================================================
import { NAVY, MUTED } from "../../../styleTokens";
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Item</th>
            {!readOnly && <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Remaining</th>}
            <th className="pb-1.5 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>{readOnly ? "Qty" : "Allocate"}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(item => {
            const qty = allocations[item.id] ?? 0;
            const max = remaining[item.id] ?? 0;
            return (
              <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 pr-2" style={{ color: NAVY }}>{item.label}</td>
                {!readOnly && <td className="py-1.5 pr-2 text-right" style={{ color: MUTED }}>{max} {item.unit}</td>}
                <td className="py-1.5 text-right">
                  {readOnly ? (
                    <span style={{ color: NAVY }}>{qty} {item.unit}</span>
                  ) : (
                    <input type="number" min={0} max={max} value={qty}
                      onChange={e => onChange?.(item.id, Math.max(0, Math.min(Number(e.target.value), max)))}
                      className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
