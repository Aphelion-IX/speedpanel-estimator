// =============================================================================
// Admin Products -- category filter chips
// =============================================================================
import { BLUE, WHITE } from "../../../styleTokens";
import { CATEGORY_LABEL, type ProductCategory } from "./productTypes";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ProductCategory[];

export const ProductCategoryChips = ({ active, onChange }: { active: ProductCategory; onChange: (c: ProductCategory) => void }) => (
  <div className="flex flex-wrap gap-2">
    {CATEGORIES.map(c => {
      const on = active === c;
      return (
        <button key={c} onClick={() => onChange(c)}
          className={"rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 " + (on ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
          style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
          {CATEGORY_LABEL[c]}
        </button>
      );
    })}
  </div>
);
