// =============================================================================
// Pro forma invoice -- on-screen preview + Excel export
// =============================================================================
// The on-screen content below is a preview only -- "Save as Excel"
// (buildOrderWorkbook.ts/exportOrderToExcel.ts, same xlsx-package convention
// as the main estimate's exportEstimateToExcel.ts) is the actual "get a file
// out of this" mechanism, replacing an earlier window.print()/PDF approach.
//
// Requires the normal owner-or-admin `orders`/`order_deliveries` RLS --
// deliberately NOT a public/shareable link (confirmed decision): a recipient
// must be signed in as the order's owner or an admin, same as every other
// page in this app.
// =============================================================================
import { useOrder } from "./orderDetailStore";
import { useOrderDeliveries } from "./orderDeliveriesStore";
import { useProject } from "../projectDetailStore";
import { exportOrderToExcel } from "../../../export/exportOrderToExcel";
import { NAVY, BLUE, MUTED } from "../../../styleTokens";

export const ProformaInvoicePage = ({ orderId, onBack }: { orderId: string; onBack: () => void }) => {
  const { order, loading: orderLoading, error: orderError } = useOrder(orderId);
  const { deliveries, loading: deliveriesLoading } = useOrderDeliveries(orderId);
  const { project } = useProject(order?.project_id ?? "");

  if (orderLoading || deliveriesLoading) {
    return <div className="p-8 text-sm" style={{ color: MUTED }}>Loading...</div>;
  }

  if (orderError || !order) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600 dark:text-red-300">{orderError || "Order not found."}</p>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back</button>
      </div>
    );
  }

  if (order.stage !== "proforma_issued") {
    return (
      <div className="p-8">
        <p className="text-sm" style={{ color: MUTED }}>This order doesn't have a pro forma invoice yet.</p>
        <button onClick={onBack} className="mt-2 text-sm font-bold" style={{ color: BLUE }}>Back</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-10" style={{ color: NAVY }}>
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back</button>
        <button onClick={() => exportOrderToExcel(order, deliveries, project?.name ?? "Project")}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: BLUE }}>
          Save as Excel
        </button>
      </div>

      <div className="border border-slate-200 p-8">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="text-xl font-extrabold tracking-tight" style={{ color: BLUE }}>SPEEDPANEL</div>
            <p className="mt-1 text-xs" style={{ color: MUTED }}>Pro forma invoice</p>
          </div>
          <div className="text-right text-xs" style={{ color: MUTED }}>
            <div>Order ref: {order.id.slice(0, 8).toUpperCase()}</div>
            <div>Issued {order.proforma_issued_at ? new Date(order.proforma_issued_at).toLocaleDateString() : ""}</div>
          </div>
        </div>

        {project && <p className="mt-4 text-sm font-semibold">Project: {project.name}</p>}

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide" style={{ color: MUTED }}>
              <th className="pb-2">Item</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-left pl-2">Unit</th>
              <th className="pb-2 text-right">Unit price</th>
              <th className="pb-2 text-right">Total (ex GST)</th>
            </tr>
          </thead>
          <tbody>
            {order.line_items.map(item => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-2">{item.label}{!item.matched && " (price to be confirmed)"}</td>
                <td className="py-2 text-right">{item.qty}</td>
                <td className="py-2 pl-2">{item.unit}</td>
                <td className="py-2 text-right">{item.unitPriceExGst != null ? `$${item.unitPriceExGst.toFixed(2)}` : "--"}</td>
                <td className="py-2 text-right">${item.lineTotalExGst.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span style={{ color: MUTED }}>Subtotal (ex GST)</span><span>${order.subtotal_ex_gst.toFixed(2)}</span></div>
          <div className="flex justify-between"><span style={{ color: MUTED }}>GST ({(order.gst_rate * 100).toFixed(0)}%)</span><span>${order.gst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-1 font-bold"><span>Total (inc GST)</span><span>${order.total_inc_gst.toFixed(2)}</span></div>
        </div>

        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: MUTED }}>Delivery schedule</div>
          {deliveries.map(d => (
            <div key={d.id} className="mt-2 text-sm">
              <span className="font-semibold">Delivery {d.sequence_no}:</span>{" "}
              {d.address_line1}{d.address_line2 ? `, ${d.address_line2}` : ""}, {d.suburb} {d.state} {d.postcode}
              {d.requested_date && ` -- requested ${new Date(d.requested_date).toLocaleDateString()}`}
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed" style={{ color: MUTED }}>
          This is a pro forma invoice for planning purposes only and does not constitute a tax invoice.
          Pricing for any item marked "price to be confirmed" will be provided separately before dispatch.
        </p>
      </div>
    </div>
  );
};
