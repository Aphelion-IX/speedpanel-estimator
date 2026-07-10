// =============================================================================
// Manufacturing progress -- read-only display
// =============================================================================
// Shared by ProjectDashboard.tsx's Manufacturing & Delivery card (the
// project's latest confirmed order) and OrderDetailPage.tsx (that specific
// order), so the percent-calculation + progress-bar JSX exists in exactly
// one place. Admin-editable via AdminManufacturingPage.tsx -- this component
// is always read-only.
// =============================================================================
import { cx, NAVY, BLUE } from "../../../styleTokens";
import { totalPanelCount, type OrderRow } from "./orderTypes";

export const ManufacturingProgress = ({ order }: { order: OrderRow }) => {
  const total = totalPanelCount(order.line_items);
  const made = order.panels_manufactured;
  const pct = total > 0 && made != null ? Math.round((made / total) * 100) : null;
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: NAVY }}>
          {made != null ? `${made} of ${total} panels manufactured` : "Not started"}
        </span>
        {pct != null && <span className="text-sm font-bold" style={{ color: BLUE }}>{pct}%</span>}
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BLUE }} />
        </div>
      )}
      {order.manufacturing_est_completion && (
        <p className={cx.footnote}>Est. completion {new Date(order.manufacturing_est_completion).toLocaleDateString()}</p>
      )}
    </>
  );
};
