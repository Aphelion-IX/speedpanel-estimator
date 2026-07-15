// =============================================================================
// Order line items -- editable review table (bespoke, not RepeatableRowEditor)
// =============================================================================
// RepeatableRowEditor (src/pages/admin/shared/repeatableRowEditor.tsx) makes
// every cell editable and always shows an "Add row" affordance -- wrong here:
// label/unit come straight from the certified estimate + priced catalog and
// must stay read-only (a customer can't invent a new line item), only
// quantity and include/exclude are customer-editable, and there's no "add"
// action at all.
//
// `editablePrice` is a separate, staff-only opt-in (AdminOrdersPage.tsx's
// revise-order flow) -- a customer can never change what something costs,
// but Internal Sales correcting a submitted quote's pricing is exactly what
// revise_order() exists for. Off by default so every existing customer-
// facing/read-only usage is unaffected.
// =============================================================================
import { NAVY, MUTED, GOLD } from "../../../styleTokens";
import { round2, type OrderLineItem } from "../../../export/priceEstimateReportData";

export interface DraftLineItem extends OrderLineItem { included: boolean; }

export const OrderLineItemsTable = ({ items, onChange, readOnly, editablePrice }: {
  items: DraftLineItem[]; onChange?: (items: DraftLineItem[]) => void; readOnly?: boolean; editablePrice?: boolean;
}) => {
  const setQty = (id: string, qty: number) => {
    onChange?.(items.map(i => i.id === id
      ? { ...i, qty, lineTotalExGst: i.matched ? round2((i.unitPriceExGst ?? 0) * qty) : 0 }
      : i));
  };
  const setUnitPrice = (id: string, unitPriceExGst: number) => {
    onChange?.(items.map(i => i.id === id
      ? { ...i, unitPriceExGst, matched: true, lineTotalExGst: round2(unitPriceExGst * i.qty) }
      : i));
  };
  const setIncluded = (id: string, included: boolean) => {
    onChange?.(items.map(i => i.id === id ? { ...i, included } : i));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {!readOnly && <th className="w-8 pb-1.5" />}
            <th className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Item</th>
            <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Qty</th>
            <th className="pb-1.5 pr-2 text-left text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Unit</th>
            <th className="pb-1.5 pr-2 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Unit price</th>
            <th className="pb-1.5 text-right text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Total (ex GST)</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800" style={{ opacity: item.included ? 1 : 0.4 }}>
              {!readOnly && (
                <td className="py-1.5">
                  <input type="checkbox" checked={item.included} onChange={e => setIncluded(item.id, e.target.checked)} />
                </td>
              )}
              <td className="py-1.5 pr-2" style={{ color: NAVY }}>
                {item.label}
                {!item.matched && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: GOLD, color: NAVY }}>
                    Not priced
                  </span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-right">
                {readOnly ? item.qty : (
                  <input type="number" value={item.qty} disabled={!item.included}
                    onChange={e => setQty(item.id, Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
                )}
              </td>
              <td className="py-1.5 pr-2" style={{ color: MUTED }}>{item.unit}</td>
              <td className="py-1.5 pr-2 text-right" style={{ color: MUTED }}>
                {editablePrice ? (
                  <input type="number" step="0.01" value={item.unitPriceExGst ?? ""} disabled={!item.included}
                    onChange={e => setUnitPrice(item.id, Number(e.target.value))}
                    className="w-24 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
                ) : (
                  item.unitPriceExGst != null ? `$${item.unitPriceExGst.toFixed(2)}` : "--"
                )}
              </td>
              <td className="py-1.5 text-right font-semibold" style={{ color: NAVY }}>
                {item.included ? `$${item.lineTotalExGst.toFixed(2)}` : "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
