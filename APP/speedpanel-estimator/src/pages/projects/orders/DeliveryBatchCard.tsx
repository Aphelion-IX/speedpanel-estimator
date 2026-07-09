// =============================================================================
// One existing delivery batch -- read-only address + allocation summary
// =============================================================================
import { Trash2 } from "lucide-react";
import { cx, NAVY, MUTED, BLUE } from "../../../styleTokens";
import { AccordionCard } from "../../../ui/primitives";
import type { OrderLineItem } from "../../../export/priceEstimateReportData";
import type { OrderDeliveryRow } from "./orderTypes";
import { LineItemAllocationTable } from "./LineItemAllocationTable";

export const DeliveryBatchCard = ({ delivery, lineItems, canRemove, onRemove }: {
  delivery: OrderDeliveryRow; lineItems: OrderLineItem[]; canRemove: boolean; onRemove: (id: string) => void;
}) => {
  const allocations = Object.fromEntries(delivery.item_allocations.map(a => [a.lineItemId, a.qty]));

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold" style={{ color: NAVY }}>Delivery {delivery.sequence_no}</div>
          <p className={cx.footnote}>
            {delivery.address_line1}{delivery.address_line2 ? `, ${delivery.address_line2}` : ""}, {delivery.suburb} {delivery.state} {delivery.postcode}
          </p>
          {delivery.requested_date && <p className={cx.footnote}>Requested {new Date(delivery.requested_date).toLocaleDateString()}</p>}
          {(delivery.contact_name || delivery.contact_phone) && (
            <p className={cx.footnote}>{[delivery.contact_name, delivery.contact_phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {canRemove && (
          <button onClick={() => onRemove(delivery.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {delivery.notes && <p className="mt-2 text-sm" style={{ color: MUTED }}>{delivery.notes}</p>}
      <div className="mt-3">
        <AccordionCard summary={<span style={{ color: BLUE }}>Items in this delivery ({delivery.item_allocations.length})</span>}>
          <LineItemAllocationTable items={lineItems} remaining={{}} allocations={allocations} readOnly />
        </AccordionCard>
      </div>
    </div>
  );
};
