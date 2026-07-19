// =============================================================================
// Order entry -- top-level "place an order" shortcut
// =============================================================================
// Emptied out -- the project picker this used to render (see git history)
// queried the projects table, which no longer exists. Same "keep the page,
// clear the content, rebuild from scratch" treatment as AdminDashboard.tsx's
// tile grid. Takes no props for now -- App.tsx's call site was simplified to
// match; re-add them once this is rebuilt against real data again.
// =============================================================================
import { cx, MUTED } from "../../styleTokens";

export const OrderEntryPage = () => (
  <div className="mt-2">
    <h1 className={cx.h1}>Place an order</h1>
    <p className="mt-1 text-sm" style={{ color: MUTED }}>This page is being rebuilt.</p>
  </div>
);
