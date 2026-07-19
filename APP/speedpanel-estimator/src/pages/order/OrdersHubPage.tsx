// =============================================================================
// Orders Hub -- customer-facing Orders overview
// =============================================================================
// Restyled to match UI-DESIGNS/pages/customer-orders-overview.html exactly
// -- see ordersTheme.css for the scoped `.ord-*` palette/shape this page
// (and every other Orders page) render with. Real breakpoints already baked
// into that stylesheet, ported verbatim from the mockup's own single
// responsive file.
//
// "New Order" opens NewOrderSourcePage.tsx (a chooser: Estimate/Manual/
// Repeat) instead of embedding OrderEntryPage.tsx -- that page is a dead
// stub, see NewOrderSourcePage.tsx's header comment for why.
// =============================================================================
import { useMemo, useState } from "react";
import { ShoppingCart, Search, CircleAlert, Plus } from "lucide-react";
import type { UseAuth } from "../../lib/useAuth";
import type { UseCompanyMemberships } from "../../lib/useCompanyMemberships";
import type { Route } from "../../appShell/useHashRoute";
import { EmptyState, ErrorState, LoadingState } from "../../ui/states";
import type { EffectiveLayout } from "../../useLayoutMode";
import { ORDER_OPERATIONAL_STATUS_LABELS } from "../projects/orders/orderOperationsTypes";
import { useCustomerOrders } from "./customerOrdersStore";
import { NewOrderSourcePage } from "./NewOrderSourcePage";
import "./ordersTheme.css";

export const OrdersHubPage = ({ auth, company, layoutMode, navigate }: {
  auth: UseAuth; company: UseCompanyMemberships; layoutMode: EffectiveLayout; navigate: (route: Route) => void;
}) => {
  const { orders, metrics, loading, error, reload } = useCustomerOrders(company.activeCompanyId);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [primaryTab, setPrimaryTab] = useState<"all" | "drafts" | "active" | "completed">("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter(order => {
      const status = order.order_operations?.operational_status;
      if (primaryTab === "drafts" && status !== "draft") return false;
      if (primaryTab === "completed" && status !== "completed") return false;
      if (primaryTab === "active" && (status === "draft" || status === "completed" || status === "cancelled" || !status)) return false;
      if (!normalized) return true;
      return [
        order.order_number ?? "", order.projects?.name ?? "", order.projects?.project_number ?? "", order.stage,
        status ? ORDER_OPERATIONAL_STATUS_LABELS[status] : "",
      ].join(" ").toLowerCase().includes(normalized);
    });
  }, [orders, query, primaryTab]);

  if (creating) {
    return (
      <NewOrderSourcePage user={auth.user} activeCompanyId={company.activeCompanyId} layoutMode={layoutMode}
        navigate={navigate} onBack={() => setCreating(false)} />
    );
  }

  return (
    <div className="ord-shell">
      <div className="ord-pagehead">
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> Orders</div>
          <h1>Orders</h1>
          <p>View drafts, submitted orders, quotes and active fulfilment.</p>
        </div>
        <div className="ord-page-actions">
          <button className="ord-btn primary" onClick={() => setCreating(true)}><Plus size={14} />New Order</button>
        </div>
      </div>

      <div className="ord-summary-strip">
        <div className="ord-summary-box"><span>Current Orders</span><strong>{metrics.total}</strong></div>
        <div className="ord-summary-box"><span>Action Required</span><strong>{metrics.actionRequired}</strong></div>
        <div className="ord-summary-box"><span>Quotes Ready</span><strong>{metrics.quotes}</strong></div>
        <div className="ord-summary-box"><span>In Fulfilment</span><strong>{metrics.fulfilment}</strong></div>
      </div>

      <div className="ord-toolbar">
        <div className="ord-search">
          <Search size={16} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by order, project or customer reference" />
        </div>
        <div className="ord-segmented">
          {(["all", "drafts", "active", "completed"] as const).map(t => (
            <button key={t} onClick={() => setPrimaryTab(t)} className={`ord-seg ${primaryTab === t ? "active" : ""}`}>
              {t === "all" ? "All" : t === "drafts" ? "Drafts" : t === "active" ? "Active" : "Completed"}
            </button>
          ))}
        </div>
        <button className="ord-btn secondary">Filters</button>
      </div>

      {loading && <LoadingState className="mt-4" label="Loading orders" />}
      {!loading && error && <ErrorState className="mt-4" message={error} onRetry={() => reload()} />}

      {!loading && !error && filtered.length === 0 && (
        <div className="ord-card"><EmptyState message={query ? "No orders match your search." : "No orders yet. Create an order from an estimate or use Quick Order."} /></div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="ord-order-list">
          {filtered.map(order => {
            const operations = order.order_operations;
            const status = operations?.operational_status;
            const actionRequired = operations?.customer_action_required ?? false;
            const total = operations?.commercial_total_inc_gst ?? order.total_inc_gst;

            return (
              <button key={order.id} onClick={() => navigate({ tab: "projects", id: order.project_id, orderId: order.id })} className="ord-order-row">
                <div>
                  <h3>{order.order_number ?? order.id.slice(0, 8).toUpperCase()}</h3>
                  <div className="ord-meta">
                    <span>{order.projects?.name ?? "Unknown project"}</span>
                    <span>{order.projects?.project_number ?? ""}</span>
                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="ord-status-col">
                  {status && <span className={`ord-badge ${status === "completed" ? "green" : status === "changes_required" ? "red" : ""}`}>{ORDER_OPERATIONAL_STATUS_LABELS[status]}</span>}
                  {actionRequired && <strong style={{ color: "var(--ord-red)" }}><CircleAlert size={11} style={{ display: "inline", marginRight: 4 }} />Action required</strong>}
                </div>
                <div className="ord-status-col"><span className="ord-muted ord-tiny">Order value</span><strong>${total.toFixed(2)}</strong></div>
                <div className="ord-actions"><span className="ord-btn secondary"><ShoppingCart size={13} />Open Order</span></div>
              </button>
            );
          })}
        </div>
      )}

      {!auth.user && <p className="mt-3 text-sm" style={{ color: "var(--ord-red)" }}>Sign in to create and manage orders.</p>}
    </div>
  );
};
