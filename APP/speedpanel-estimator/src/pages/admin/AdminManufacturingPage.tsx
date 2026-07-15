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
import { cx, NAVY } from "../../styleTokens";
import { Button } from "../../ui/button";
import { LoadingState, ErrorState, EmptyState } from "../../ui/states";
import { ErrorDialog } from "../../ui/confirmDialog";
import { Field, NumField } from "../shared/fields";
import { useAdminManufacturing, type AdminManufacturingOrder } from "./manufacturing/adminManufacturingStore";
import { DeliveryBatchCard } from "../projects/orders/DeliveryBatchCard";
import { totalPanelCount, type DeliveryStatus } from "../projects/orders/orderTypes";
import type { InternalRole } from "../company/staffTypes";

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
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const err = await onSaveManufacturing(order.id, { panels_manufactured: manufactured, manufacturing_est_completion: estCompletion || null });
    setSaving(false);
    if (err) setError(err);
  };

  const handleStatusChange = async (deliveryId: string, status: DeliveryStatus) => {
    const err = await onStatusChange(deliveryId, status);
    if (err) setStatusError(err);
  };

  return (
    <div className={`${cx.card} mt-3`}>
      <ErrorDialog message={statusError} onDismiss={() => setStatusError(null)} />
      <div className="text-sm font-bold" style={{ color: NAVY }}>{projectName}</div>
      <p className={cx.footnote}>
        Confirmed {new Date(order.proforma_issued_at ?? order.created_at).toLocaleDateString()} -- ${order.total_inc_gst.toFixed(2)}
      </p>

      <div className="mt-3">
        <div className={cx.cardHd}>Manufacturing</div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48"><NumField label={`Panels manufactured (of ${total})`} value={manufactured} onChange={setManufactured} /></div>
          <div className="w-44"><Field label="Est. completion" value={estCompletion} onChange={setEstCompletion} type="date" /></div>
          <Button className="h-[46px]" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
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

export const AdminManufacturingPage = ({ userId, staffRole, staffRoleLoading }: {
  userId: string | null; staffRole: InternalRole | null; staffRoleLoading: boolean;
}) => {
  const { rows, loading, loadingMore, hasMore, error, reload, loadMore, updateManufacturing, updateDeliveryStatus } = useAdminManufacturing(userId, staffRole, staffRoleLoading);

  if (loading) return <LoadingState className="mt-6" label="Loading manufacturing queue" />;

  if (error) {
    return <ErrorState className="mt-6" message={error} onRetry={() => reload()} />;
  }

  if (rows.length === 0) {
    return <EmptyState className={`${cx.card} mt-6 text-center`} message="No confirmed orders in production yet." />;
  }

  return (
    <div className="mt-2">
      {rows.map(row => (
        <ManufacturingRow key={row.order.id} row={row} onSaveManufacturing={updateManufacturing} onStatusChange={updateDeliveryStatus} />
      ))}

      {hasMore && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  );
};
