// =============================================================================
// StickyBar
// =============================================================================
// Mobile bottom sticky summary bar -- no fixed/sticky-bottom pattern existed
// anywhere in the app before this. Shows either the selected wall's totals
// or the whole project's totals (caller controls which via `view`) plus a
// "Review Order" action; the wall/project toggle itself is owned by whatever
// screen renders this, not this component.
// =============================================================================
import { cx, BLUE } from "../styleTokens";

export interface StickyBarStat {
  value: string | number;
  label: string;
}

export const StickyBar = ({ view, wallStats, projectStats, onReviewOrder, lineItemCount }: {
  view: "wall" | "project";
  wallStats: StickyBarStat[];
  projectStats: StickyBarStat[];
  onReviewOrder: () => void;
  lineItemCount?: number;
}) => {
  const stats = view === "wall" ? wallStats : projectStats;
  return (
    <div className={cx.stickyBar}>
      <div className="flex flex-1 items-center gap-4 overflow-x-auto">
        {stats.map((s, i) => (
          <div key={i} className="shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">{s.label}</div>
            <div className="text-sm font-extrabold leading-tight" style={{ color: BLUE }}>{s.value}</div>
          </div>
        ))}
      </div>
      <button onClick={onReviewOrder} className={cx.stickyBarBtn}>
        Review Order{typeof lineItemCount === "number" ? ` · ${lineItemCount} line${lineItemCount === 1 ? "" : "s"}` : ""}
      </button>
    </div>
  );
};
