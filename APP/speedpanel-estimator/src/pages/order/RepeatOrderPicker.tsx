// =============================================================================
// Repeat Previous Order -- customer picks an eligible past order to copy
// =============================================================================
// Matches UI-DESIGNS/pages/repeat-order.html exactly. "Eligible" mirrors
// copy_order_to_draft()'s own server-side rule for kind='repeat' (see
// supabase/schema.sql) -- accepted/processing/manufacturing/
// ready_for_delivery/partially_delivered/completed -- so a row that would
// be rejected server-side is never offered here. Calls the real
// repeat_order RPC directly (same one orderOperationsStore.ts's
// createLinkedDraft("repeat") wraps) rather than duplicating that hook's
// hardcoded single-orderId shape across a list of rows.
// =============================================================================
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import type { Route } from "../../appShell/useHashRoute";
import { EmptyState, LoadingState, ErrorState } from "../../ui/states";
import { useCustomerOrders, type CustomerOrderListRow } from "./customerOrdersStore";
import type { OrderOperationalStatus } from "../projects/orders/orderOperationsTypes";
import "./ordersTheme.css";

const REPEAT_ELIGIBLE: OrderOperationalStatus[] = ["accepted", "processing", "manufacturing", "ready_for_delivery", "partially_delivered", "completed"];

export const RepeatOrderPicker = ({ activeCompanyId, navigate, onBack }: {
  activeCompanyId: string | null; navigate: (route: Route) => void; onBack: () => void;
}) => {
  const { orders, loading, error, reload } = useCustomerOrders(activeCompanyId);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const eligible = orders.filter(o => REPEAT_ELIGIBLE.includes(o.order_operations?.operational_status ?? "draft" as OrderOperationalStatus));

  const copyOrder = async (order: CustomerOrderListRow) => {
    if (!supabase) return;
    setCopyingId(order.id);
    setCopyError(null);
    const { data, error: rpcError } = await supabase.rpc("repeat_order", { p_source_order_id: order.id });
    setCopyingId(null);
    if (rpcError) { setCopyError(rpcError.message); return; }
    if (typeof data === "string") {
      navigate({ tab: "projects", id: order.project_id, orderId: data });
    }
  };

  return (
    <div className="ord-shell">
      <button onClick={onBack} className="ord-link" style={{ marginBottom: 12 }}>&larr; New Order</button>
      <div className="ord-pagehead">
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> Repeat Previous Order</div>
          <h1>Repeat Previous Order</h1>
          <p>Copy products into a new draft and reconfirm the project details.</p>
        </div>
      </div>

      {loading && <LoadingState className="mt-4" label="Loading orders" />}
      {!loading && error && <ErrorState className="mt-4" message={error} onRetry={() => reload()} />}

      {!loading && !error && (
        <section className="ord-section">
          <div className="ord-section-head">
            <div><h2>Select Previous Order</h2><p>Only delivered or accepted orders can be copied.</p></div>
          </div>
          {eligible.length === 0 ? (
            <EmptyState message="No eligible previous orders yet." />
          ) : (
            <div className="ord-order-list">
              {eligible.map(order => (
                <div key={order.id} className="ord-order-row">
                  <div>
                    <h3>{order.order_number ?? order.id.slice(0, 8).toUpperCase()}</h3>
                    <div className="ord-meta">
                      <span>{new Date(order.updated_at).toLocaleDateString()}</span>
                      <span>{order.line_items.length} product line{order.line_items.length === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                  <div className="ord-status-col"><span className="ord-badge neutral">{order.order_operations?.operational_status ?? order.stage}</span></div>
                  <div className="ord-status-col"><span className="ord-muted ord-tiny">Original project</span><strong>{order.projects?.name ?? "Unknown project"}</strong></div>
                  <div>
                    <button className="ord-btn primary" disabled={copyingId === order.id} onClick={() => copyOrder(order)}>
                      {copyingId === order.id ? "Copying..." : "Copy Order"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {copyError && <p className="mt-2 text-sm" style={{ color: "var(--ord-red)" }}>{copyError}</p>}
        </section>
      )}

      <div className="ord-info-banner">
        <div className="ord-info-icon">i</div>
        <div className="ord-info-copy">
          <strong>Delivery and project details will not be copied blindly</strong>
          <span>You must reconfirm project, quantities, delivery dates, address and site contact before submission.</span>
        </div>
      </div>
    </div>
  );
};
