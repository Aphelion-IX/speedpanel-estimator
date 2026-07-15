// =============================================================================
// Order Review drawer
// =============================================================================
// Slide-over (src/ui/drawer.tsx) making the combined order reachable from
// anywhere in the project view without leaving whichever Estimate Results
// tab is open -- same OrderContent the "Order" tab itself renders, plus the
// Export to Excel action. Save as Project / Request quote aren't included
// yet: both need new prop-threading from App.tsx (open-project state, the
// save flow) that's out of scope for wiring up the drawer shell itself --
// the existing "Save as Project" banner and footer Export button stay put
// as the primary entry points during this transition.
// =============================================================================
import { FileSpreadsheet } from "lucide-react";
import { cx } from "../styleTokens";
import { Drawer } from "../ui/drawer";
import type { EffectiveLayout } from "../useLayoutMode";
import { aggregate } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { WallResult } from "../estimate/wall.types";
import { OrderContent } from "./orderContent";

export const OrderReviewDrawer = ({
  open, onClose, layoutMode, projChosenAgg, combinedEstimate, results, onExport, exportDisabled,
}: {
  open: boolean; onClose: () => void; layoutMode: EffectiveLayout;
  projChosenAgg: ReturnType<typeof aggregate>; combinedEstimate: CombinedEstimate; results: WallResult[];
  onExport: () => void; exportDisabled: boolean;
}) => (
  <Drawer open={open} onClose={onClose} layoutMode={layoutMode} title="Review order">
    <OrderContent layoutMode={layoutMode} projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate} results={results} />
    <button onClick={onExport} disabled={exportDisabled} className={exportDisabled ? cx.exportBtnDisabled : cx.exportBtn}>
      <FileSpreadsheet size={16} /> Export to Excel
    </button>
  </Drawer>
);
