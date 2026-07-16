// =============================================================================
// Item pill scroller (phone)
// =============================================================================
// Horizontal-scrolling pill strip for selecting the active wall/kit item on
// phone -- the phone-only visual counterpart to the vertical NavRow list
// estimateStructureNav.tsx renders on web. Deliberately domain-agnostic (no
// Wall/kit types) so both InternalCalculator's and ExternalCalculator's own
// estimateStructureNav.tsx can each map their own item shape to PillItem and
// share this one presentational component.
// =============================================================================
import { cx, BLUE, GOLD, NAVY, MUTED, WHITE } from "../styleTokens";

export interface PillItem { id: string; label: string; sublabel?: string; active: boolean; warn: boolean; }

export const ItemPillScroller = ({ items, onSelect, trailing }: {
  items: PillItem[]; onSelect: (id: string) => void; trailing?: React.ReactNode;
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({items.length})</div>
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={"relative min-w-[168px] shrink-0 snap-start rounded-xl border-2 px-3.5 py-3 text-left active:scale-95 transition-all " + (item.active ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
          style={item.active ? { borderColor: BLUE, background: BLUE } : undefined}
        >
          {item.warn && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />}
          <div className="truncate text-sm font-bold" style={{ color: item.active ? WHITE : NAVY }}>{item.label}</div>
          {item.sublabel && (
            <div className="mt-1 truncate text-xs font-medium" style={{ color: item.active ? "rgba(255,255,255,0.7)" : MUTED }}>{item.sublabel}</div>
          )}
        </button>
      ))}
      {trailing}
    </div>
  </div>
);
