// =============================================================================
// Start a New Order -- source chooser (Estimate / Manual / Repeat)
// =============================================================================
// Matches UI-DESIGNS/pages/new-order-source.html. Not part of the supplied
// bundle -- the bundle's OrdersHubPage.tsx embedded the existing
// OrderEntryPage.tsx for "New Order", but that page is a dead 18-line stub
// ("This page is being rebuilt", zero props); the real, working
// order-creation flows are project-scoped -- OrderBuilderPage.tsx
// (Estimator-derived) and QuickOrderPage.tsx (manual), both reached only
// via ProjectsRouter.tsx's route.newOrder/route.quickOrder. So "Order from
// Estimate"/"Quick Manual Order" open the existing ProjectPickerDrawer.tsx
// (same component ProjectsListPage.tsx's own Quick Order quick-action
// already uses) and navigate straight into those real pages once a project
// is picked, instead of a fabricated flow.
// =============================================================================
import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Route } from "../../appShell/useHashRoute";
import { useProjects } from "../projects/projectsStore";
import { ProjectPickerDrawer } from "../projects/ProjectPickerDrawer";
import type { EffectiveLayout } from "../../useLayoutMode";
import { RepeatOrderPicker } from "./RepeatOrderPicker";
import "./ordersTheme.css";

export const NewOrderSourcePage = ({ user, activeCompanyId, layoutMode, navigate, onBack }: {
  user: User | null; activeCompanyId: string | null; layoutMode: EffectiveLayout; navigate: (route: Route) => void; onBack: () => void;
}) => {
  const { projects } = useProjects(user, activeCompanyId);
  const [mode, setMode] = useState<"choose" | "repeat">("choose");
  const [pickerFor, setPickerFor] = useState<"estimate" | "quick" | null>(null);

  if (mode === "repeat") {
    return <RepeatOrderPicker activeCompanyId={activeCompanyId} navigate={navigate} onBack={() => setMode("choose")} />;
  }

  return (
    <div className="ord-shell">
      <button onClick={onBack} className="ord-link" style={{ marginBottom: 12 }}>&larr; Orders</button>
      <div className="ord-pagehead">
        <div>
          <div className="ord-crumbs">Orders <span>&rsaquo;</span> Start a New Order</div>
          <h1>Start a New Order</h1>
          <p>Choose the most appropriate starting point for this project order.</p>
        </div>
      </div>

      <div className="ord-grid three">
        <button onClick={() => setPickerFor("estimate")} className="ord-card" style={{ borderTop: "4px solid var(--ord-blue)", textAlign: "left" }}>
          <span className="ord-badge green">Recommended</span>
          <h2 style={{ marginTop: 12 }}>Order from Estimate</h2>
          <p className="ord-muted ord-small" style={{ marginTop: 6 }}>Import panel schedules, tracks, accessories and wall references from a completed estimate.</p>
          <div className="ord-btn primary" style={{ marginTop: 12, pointerEvents: "none" }}>Select Estimate</div>
        </button>
        <button onClick={() => setPickerFor("quick")} className="ord-card" style={{ borderTop: "4px solid var(--ord-blue)", textAlign: "left" }}>
          <span className="ord-badge">Flexible</span>
          <h2 style={{ marginTop: 12 }}>Quick Manual Order</h2>
          <p className="ord-muted ord-small" style={{ marginTop: 6 }}>Build an order directly by selecting panels, tracks, flashings, fixings and accessories.</p>
          <div className="ord-btn secondary" style={{ marginTop: 12, pointerEvents: "none" }}>Start Manual Order</div>
        </button>
        <button onClick={() => setMode("repeat")} className="ord-card" style={{ borderTop: "4px solid var(--ord-cyan)", textAlign: "left" }}>
          <span className="ord-badge cyan">Repeat</span>
          <h2 style={{ marginTop: 12 }}>Repeat Previous Order</h2>
          <p className="ord-muted ord-small" style={{ marginTop: 6 }}>Copy a previous order, then reconfirm quantities, delivery dates and project details.</p>
          <div className="ord-btn secondary" style={{ marginTop: 12, pointerEvents: "none" }}>Choose Previous Order</div>
        </button>
      </div>

      {pickerFor && (
        <ProjectPickerDrawer
          title={pickerFor === "estimate" ? "Order from Estimate -- choose a project" : "Quick Manual Order -- choose a project"}
          projects={projects} layoutMode={layoutMode}
          onPick={p => navigate(pickerFor === "estimate" ? { tab: "projects", id: p.id, newOrder: true } : { tab: "projects", id: p.id, quickOrder: true })}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>
  );
};
