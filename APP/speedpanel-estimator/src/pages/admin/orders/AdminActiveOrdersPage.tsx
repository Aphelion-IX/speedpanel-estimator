
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../../ui/states";
import type { InternalRole } from "../../company/staffTypes";
import {
  ORDER_OPERATIONAL_STATUS_LABELS,
} from "../../projects/orders/orderOperationsTypes";
import { AdminOrderOperationsPanel } from "./AdminOrderOperationsPanel";
import { AdminOrderPricingFeesCard } from "./AdminOrderPricingFeesCard";
import { AdminOrderHoldsCard } from "./AdminOrderHoldsCard";
import { AdminOrderAuditCard } from "./AdminOrderAuditCard";
import { AdminOrderReviewCard } from "./AdminOrderReviewCard";
import { OrderDocumentsCard } from "../../projects/orders/OrderDocumentsCard";
import { useAdminOrderOperations } from "./adminOrderOperationsStore";
import "../../order/ordersTheme.css";

export const AdminActiveOrdersPage = ({
  userId,
  staffRole,
  staffRoleLoading,
}: {
  userId: string | null;
  staffRole: InternalRole | null;
  staffRoleLoading: boolean;
}) => {
  const {
    orders,
    counts,
    loading,
    error,
    reload,
  } = useAdminOrderOperations(
    userId,
    staffRole,
    staffRoleLoading,
  );
  const [query, setQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return orders;

    return orders.filter(row =>
      [
        row.orders.order_number ?? "",
        row.orders.id,
        row.orders.projects?.name ?? "",
        row.orders.projects?.project_number ?? "",
        ORDER_OPERATIONAL_STATUS_LABELS[
          row.operational_status
        ],
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [orders, query]);

  if (loading) {
    return (
      <LoadingState
        className="mt-6"
        label="Loading active orders"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        className="mt-6"
        message={error}
        onRetry={() => reload()}
      />
    );
  }

  const selected =
    orders.find(row => row.order_id === selectedOrderId) ??
    null;

  if (selected) {
    return (
      <div className="ord-shell mt-2">
        <button
          className="ord-link"
          onClick={async () => {
            await reload();
            setSelectedOrderId(null);
          }}
        >
          &larr; Active Orders
        </button>

        <div className="ord-detail-grid mt-3">
          <div>
            <AdminOrderReviewCard
              orderId={selected.order_id}
            />
            <AdminOrderPricingFeesCard
              orderId={selected.order_id}
            />
            <AdminOrderHoldsCard
              orderId={selected.order_id}
            />
          </div>

          <div>
            <AdminOrderOperationsPanel
              orderId={selected.order_id}
            />
            <OrderDocumentsCard
              orderId={selected.order_id}
              userId={userId}
              viewerKind="staff"
            />
            <AdminOrderAuditCard
              orderId={selected.order_id}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ord-shell mt-2">
      <div className="ord-pagehead">
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> Internal Order Queue</div>
          <h1>Internal Order Queue</h1>
          <p>Sales, technical and delivery review across submitted customer orders.</p>
        </div>
      </div>

      <div className="ord-summary-strip">
        <div className="ord-summary-box"><span>Active</span><strong>{counts.total}</strong></div>
        <div className="ord-summary-box"><span>Customer Action</span><strong>{counts.actionRequired}</strong></div>
        <div className="ord-summary-box"><span>Review / Changes</span><strong>{counts.review}</strong></div>
        <div className="ord-summary-box"><span>Manufacturing</span><strong>{counts.manufacturing}</strong></div>
      </div>

      <div className="ord-toolbar">
        <div className="ord-search">
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by order, company or project"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="ord-card"><EmptyState message="No active orders match your search." /></div>
      ) : (
        <div className="ord-order-list">
          {filtered.map(row => (
            <button
              key={row.order_id}
              onClick={() => setSelectedOrderId(row.order_id)}
              className="ord-order-row internal"
            >
              <div>
                <h3>{row.orders.order_number || row.order_id.slice(0, 8).toUpperCase()}</h3>
                <div className="ord-meta">
                  <span>{row.orders.projects?.name ?? "Unknown project"}</span>
                  <span>{`$${(row.commercial_total_inc_gst ?? row.orders.total_inc_gst).toFixed(2)}`}</span>
                </div>
              </div>
              <div className="ord-status-col">
                <span className="ord-badge">{ORDER_OPERATIONAL_STATUS_LABELS[row.operational_status]}</span>
              </div>
              <div />
              <div className="ord-actions"><span className="ord-btn secondary">Review</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
