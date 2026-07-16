// =============================================================================
// Education Hub -- category filter chips
// =============================================================================
import { BLUE, WHITE } from "../styleTokens";
import { EDU_CATEGORIES, type EduCategory } from "./catalog";

export const FilterChips = ({ active, onChange }: { active: EduCategory; onChange: (c: EduCategory) => void }) => (
  <div className="flex flex-wrap gap-2">
    {EDU_CATEGORIES.map(c => {
      const on = active === c;
      return (
        <button key={c} onClick={() => onChange(c)}
          className={"rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 " + (on ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
          style={on ? { borderColor: BLUE, background: BLUE, color: WHITE } : { color: BLUE }}>
          {c}
        </button>
      );
    })}
  </div>
);
