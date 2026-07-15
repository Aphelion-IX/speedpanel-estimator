// =============================================================================
// Order Review drawer (External)
// =============================================================================
// Mirrors internalCalculator/orderReviewDrawer.tsx -- same OrderContent the
// "Order" tab renders, plus Export to Excel. Save as Project / Request quote
// aren't included yet, same reasoning as Internal's version.
// =============================================================================
import { FileSpreadsheet } from "lucide-react";
import { cx } from "../styleTokens";
import { Drawer } from "../ui/drawer";
import type { EffectiveLayout } from "../useLayoutMode";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { OrderContent } from "./orderContent";

export const OrderReviewDrawer = ({
  open, onClose, layoutMode, projAgg, combinedEstimate, onExport, exportDisabled,
}: {
  open: boolean; onClose: () => void; layoutMode: EffectiveLayout;
  projAgg: ReturnType<typeof buildExtProjAgg>; combinedEstimate: CombinedEstimate;
  onExport: () => void; exportDisabled: boolean;
}) => (
  <Drawer open={open} onClose={onClose} layoutMode={layoutMode} title="Review order">
    <OrderContent layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
    <button onClick={onExport} disabled={exportDisabled} className={exportDisabled ? cx.exportBtnDisabled : cx.exportBtn}>
      <FileSpreadsheet size={16} /> Export to Excel
    </button>
  </Drawer>
);
