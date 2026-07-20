
import { LoadingState } from "../../../ui/states";
import { useOrderOperationsAudit } from "../../projects/orders/orderOperationsStore";

export const AdminOrderAuditCard = ({
  orderId,
}: {
  orderId: string;
}) => {
  const { events, loading, error } =
    useOrderOperationsAudit(orderId);

  return (
    <div className="ord-section">
      <div className="ord-section-head"><div><h2>Order Audit</h2></div></div>
      {loading ? (
        <LoadingState label="Loading order audit" />
      ) : error ? (
        <p className="ord-small" style={{ color: "var(--ord-red)" }}>
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="ord-small ord-muted">No operational changes recorded.</p>
      ) : (
        events.map(event => (
          <div key={event.id} className="ord-row">
            <div className="ord-row-copy">
              <strong className="capitalize">{event.event_type.replace(/_/g, " ")}</strong>
              {event.reason && <span>{event.reason}</span>}
            </div>
            <span className="ord-row-end" style={{ fontWeight: 700 }}>
              {new Date(event.created_at).toLocaleString()}
            </span>
          </div>
        ))
      )}
    </div>
  );
};
