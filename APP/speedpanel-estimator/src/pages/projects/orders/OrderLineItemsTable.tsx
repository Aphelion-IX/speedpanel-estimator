// =============================================================================
// Order line items -- editable review table
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
import { Table, type TableColumn } from "../../../ui/table";
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

  const columns: TableColumn<DraftLineItem>[] = [
    ...(!readOnly ? [{
      key: "include",
      header: "",
      cell: (item: DraftLineItem) => (
        <input type="checkbox" checked={item.included} onChange={e => setIncluded(item.id, e.target.checked)} />
      ),
    }] : []),
    {
      key: "item",
      header: "Item",
      cell: item => (
        <span style={{ color: NAVY }}>
          {item.label}
          {!item.matched && (
            <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: GOLD, color: NAVY }}>
              Not priced
            </span>
          )}
        </span>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      cell: item => readOnly ? <>{item.qty}</> : (
        <input type="number" value={item.qty} disabled={!item.included}
          onChange={e => setQty(item.id, Number(e.target.value))}
          className="w-20 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
      ),
    },
    { key: "unit", header: "Unit", cell: item => <span style={{ color: MUTED }}>{item.unit}</span> },
    {
      key: "unitPrice",
      header: "Unit price",
      align: "right",
      cell: item => (
        <span style={{ color: MUTED }}>
          {editablePrice ? (
            <input type="number" step="0.01" value={item.unitPriceExGst ?? ""} disabled={!item.included}
              onChange={e => setUnitPrice(item.id, Number(e.target.value))}
              className="w-24 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right text-xs" style={{ color: NAVY }} />
          ) : (
            item.unitPriceExGst != null ? `$${item.unitPriceExGst.toFixed(2)}` : "--"
          )}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total (ex GST)",
      align: "right",
      cell: item => <span className="font-semibold" style={{ color: NAVY }}>{item.included ? `$${item.lineTotalExGst.toFixed(2)}` : "--"}</span>,
    },
  ];

  return (
    <Table
      columns={columns}
      rows={items}
      rowKey={item => item.id}
      rowStyle={item => item.included ? undefined : { opacity: 0.4 }}
    />
  );
};
