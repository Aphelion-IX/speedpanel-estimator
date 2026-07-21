// =============================================================================
// Company Accounts & Pricing -- Pricing priority explainer (Phase 9)
// =============================================================================
// Static reference card for CompanyPricingTab.tsx -- documents the exact
// 3-tier resolution order applyEffectivePricing.ts implements (Method 2's
// override tier, added in front of Phase 6's assigned-list/PL1 fallback
// chain). Nothing here is computed; it's the same fixed order regardless of
// which company is being viewed, so no props/data fetch needed.
// =============================================================================
import { ListOrdered } from "lucide-react";
import { cx, NAVY, MUTED, BLUE, WHITE } from "../../../styleTokens";

const TIERS = [
  { title: "Item price override", body: "A price set specifically for this company on this product, below. Wins over everything else while it's in effect." },
  { title: "Assigned price list", body: "This company's own assigned price list (see the Overview tab) -- used for any product without a current override." },
  { title: "PL1 -- Standard", body: "The default price list, used as a safety net if a product is missing from the assigned list entirely." },
];

export const PricingPriorityExplainer = () => (
  <section className={cx.card}>
    <h2 className={cx.h3}>How this company's pricing is resolved</h2>
    <div className="mt-3 space-y-3">
      {TIERS.map((t, i) => (
        <div key={t.title} className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: BLUE, color: WHITE }}>
            {i + 1}
          </span>
          <div>
            <strong className="text-sm" style={{ color: NAVY }}>{t.title}</strong>
            <p className="mt-0.5 text-sm" style={{ color: MUTED }}>{t.body}</p>
          </div>
        </div>
      ))}
    </div>
    <p className="mt-4 flex items-center gap-2 text-xs" style={{ color: MUTED }}>
      <ListOrdered size={13} /> A product with no override, no row on the assigned list, and no row on PL1 falls back to its catalog default price.
    </p>
  </section>
);
