// =============================================================================
// Admin > Manufacturing & Delivery
// =============================================================================
// Every confirmed order (stage = 'proforma_issued'), not a narrow queue like
// AdminOrdersPage.tsx -- this data applies for as long as the order exists,
// there's no later stage to file it under. One card per order: an editable
// "panels manufactured (of N)" + estimated completion (both plain columns
// on orders, no RPC -- see supabase/schema.sql), and each delivery batch
// reusing DeliveryBatchCard with onStatusChange to turn its status into an
// editable SelectField instead of the customer-facing read-only badge.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../styleTokens";
import { Field, NumField } from "../shared/fields";
import { useAdminManufacturing, type AdminManufacturingOrder } from "./manufacturing/adminManufacturingStore";
import { DeliveryBatchCard } from "../projects/orders/DeliveryBatchCard";
import { totalPanelCount, type DeliveryStatus } from "../projects/orders/orderTypes";

const ManufacturingRow = ({ row, onSaveManufacturing, onStatusChange }: {
  row: AdminManufacturingOrder;
  onSaveManufacturing: (orderId: string, patch: { panels_manufactured: number | null; manufacturing_est_completion: string | null }) => Promise<string | null>;
  onStatusChange: (deliveryId: string, status: DeliveryStatus) => Promise<string | null>;
}) => {
  const { order, projectName, deliveries } = row;
  const total = totalPanelCount(order.line_items);
  const [manufactured, setManufactured] = useState(order.panels_manufactured ?? 0);
  const [estCompletion, setEstCompletion] = useState(order.manufacturing_est_completion ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const err = await onSaveManufacturing(order.id, { panels_manufactured: manufactured, manufacturing_est_completion: estCompletion || null });
    setSaving(false);
    if (err) setError(err);
  };

  const handleStatusChange = async (deliveryId: string, status: DeliveryStatus) => {
    const err = await onStatusChange(deliveryId, status);
    if (err) window.alert(err);
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <div className="text-sm font-bold" style={{ color: NAVY }}>{projectName}</div>
      <p className={cx.footnote}>
        Confirmed {new Date(order.proforma_issued_at ?? order.created_at).toLocaleDateString()} -- ${order.total_inc_gst.toFixed(2)}
      </p>

      <div className="mt-3">
        <div className={cx.cardHd}>Manufacturing</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48"><NumField label={`Panels manufactured (of ${total})`} value={manufactured} onChange={setManufactured} /></div>
          <div className="w-44"><Field label="Est. completion" value={estCompletion} onChange={setEstCompletion} type="date" /></div>
          <button onClick={handleSave} disabled={saving}
            className="h-[46px] rounded-xl px-4 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {deliveries.length > 0 && (
        <div className="mt-3">
          <div className={cx.cardHd}>Deliveries</div>
          {deliveries.map(d => (
            <DeliveryBatchCard key={d.id} delivery={d} lineItems={order.line_items}
              canRemove={false} onRemove={() => {}} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
};

export const AdminManufacturingPage = () => {
  const { rows, loading, error, reload, updateManufacturing, updateDeliveryStatus } = useAdminManufacturing();

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (error) {
    return (
      <div className={`${cx.card} mt-6`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button onClick={() => reload()} className="mt-2 text-sm font-bold" style={{ color: NAVY }}>Retry</button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`${cx.card} mt-6 text-center`}>
        <p className={cx.footnote}>No confirmed orders in production yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {rows.map(row => (
        <ManufacturingRow key={row.order.id} row={row} onSaveManufacturing={updateManufacturing} onStatusChange={updateDeliveryStatus} />
      ))}
    </div>
  );
};
