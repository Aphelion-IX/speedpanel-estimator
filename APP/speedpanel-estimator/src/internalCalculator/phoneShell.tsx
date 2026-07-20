// =============================================================================
// Phone shell (Internal Calculator only)
// =============================================================================
// Presentational components for Internal Calculator's phone layout, styled to
// match the SpeedHub phone-estimator mockup: a project summary card (name,
// %-configured/warnings, progress bar, add-wall tiles), a restyled wall/kit
// pill strip, a combined title/crumb/status + metrics-grid header, and a
// tiled sticky bottom bar. Deliberately forked from the shared
// ItemPillScroller/StatsGrid/StickyBar components (rather than edited in
// place) so External Calculator's phone view -- which still uses those
// shared components -- is untouched. See kitWorkspacePhone.tsx for the same
// fork-not-branch precedent.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { Layers, Copy, Trash2, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cx, tone, BLUE, NAVY, MUTED } from "../styleTokens";
import type { Wall, ComputeOut } from "../estimate/wall.types";
import { determineWallStatus, WALL_STATUS_LABEL, WALL_STATUS_TONE, type WallStatus } from "../estimate/wallStatus";

// --- Derived item status ------------------------------------------------------
// No persisted "status" field exists on Wall/KitEntry -- this is a thin
// display mapper over the spec's formal 5-state wall status taxonomy (see
// ../estimate/wallStatus.ts's determineWallStatus), so it can't drift out of
// sync with the actual compute/validation state. "linked" is the one value
// here that ISN'T a wall status -- it's kit-only (a Corner/Shaft kit card
// always reads "Linked" once its pair exists at all -- see synthesizeKits.ts,
// which only ever produces a kit entry once both partners resolve).
export type ItemStatusKey = WallStatus | "linked";

const STATUS: Record<ItemStatusKey, { label: string; chipCx: string }> = {
  notStarted: { label: WALL_STATUS_LABEL.notStarted, chipCx: tone(WALL_STATUS_TONE.notStarted) },
  incomplete: { label: WALL_STATUS_LABEL.incomplete, chipCx: tone(WALL_STATUS_TONE.incomplete) },
  ready:      { label: WALL_STATUS_LABEL.ready,      chipCx: tone(WALL_STATUS_TONE.ready) },
  warning:    { label: WALL_STATUS_LABEL.warning,    chipCx: tone(WALL_STATUS_TONE.warning) },
  error:      { label: WALL_STATUS_LABEL.error,      chipCx: tone(WALL_STATUS_TONE.error) },
  linked:     { label: "Linked",                     chipCx: tone("info") },
};

export const statusLabel = (key: ItemStatusKey) => STATUS[key].label;
export const statusChipCx = (key: ItemStatusKey) => `${cx.badge} ${STATUS[key].chipCx}`;
// Only Ready/Warning count toward the top card's "% configured" figure --
// Not Started/Incomplete/Error all mean the wall isn't usably calculated yet.
export const isConfigured = (key: ItemStatusKey) => key === "ready" || key === "warning";

export const deriveWallStatus = (wall: Wall, walls: Wall[], out: ComputeOut): ItemStatusKey =>
  determineWallStatus(wall, walls, out);

// --- Wall/kit pill strip -------------------------------------------------------
// `thumbnail` (a small WallPreviewSection size="thumb", or a kit icon) sits in
// its own backing chip above the text -- needed regardless of the pill's own
// background so the image reads the same selected or not. onDuplicate/
// onDelete are omitted for kit pills (kits aren't a directly duplicable/
// deletable entity, only their component walls are) -- the footer row only
// renders when at least one is given.
export interface PhonePillItem {
  id: string; label: string; sublabel?: string; active: boolean; status: ItemStatusKey; thumbnail?: React.ReactNode;
  onDuplicate?: () => void; onDelete?: () => void; deleteDisabled?: boolean;
}

export const WallPillStripPhone = ({ items, onSelect, onAddWall }: {
  items: PhonePillItem[]; onSelect: (id: string) => void; onAddWall: () => void;
}) => {
  // Pills already swipe-scroll natively (touch), but that's not discoverable
  // from a static screenshot/screen-reader, and this same strip is also used
  // in the phone-width web dev viewport where a mouse has no swipe gesture --
  // so add explicit prev/next arrows too, same as the web card carousel
  // (ui/cardCarousel.tsx). No IntersectionObserver here (pills are cheap,
  // uniform width, no per-card "active" concept to derive) -- plain
  // scrollLeft/scrollWidth bounds checked on scroll are enough to know
  // whether each arrow has anywhere left to go.
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(updateScrollState, [items.length]);

  const scrollByStep = (dir: 1 | -1) => trackRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });

  return (
  <div className={`mt-3 ${cx.section}`}>
    <div className="flex items-center justify-between" style={{ marginTop: 0 }}>
      <div className={`${cx.cardHd} flex items-center gap-1.5`} style={{ marginTop: 0 }}>
        <Layers size={12} />My Walls ({items.length})
      </div>
      <button onClick={onAddWall}
        className="flex items-center gap-1 rounded-lg border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-2.5 py-1.5 text-xs font-bold active:scale-95 transition-all"
        style={{ color: BLUE }}>
        <Plus size={13} />Add wall
      </button>
    </div>
    <div className="relative">
      {canScrollLeft && (
        <button type="button" onClick={() => scrollByStep(-1)} aria-label="Scroll to previous"
          className="absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md active:scale-95 transition-all">
          <ChevronLeft size={14} style={{ color: BLUE }} />
        </button>
      )}
      <div ref={trackRef} onScroll={updateScrollState} className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map(item => (
        <div
          key={item.id}
          role="button" tabIndex={0} onClick={() => onSelect(item.id)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(item.id); } }}
          className={"min-w-[190px] shrink-0 snap-start cursor-pointer rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all " +
            (item.active ? "border-2 shadow-[0_0_0_2px_rgba(0,103,185,0.12)]" : "border-slate-200 dark:border-slate-600")}
          style={item.active ? { borderColor: BLUE } : undefined}>
          {item.thumbnail && (
            <div className="mb-2 overflow-hidden rounded-lg bg-white dark:bg-slate-900/70">
              {item.thumbnail}
            </div>
          )}
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.label}</div>
          {item.sublabel && <div className="mt-1 truncate text-xs font-medium" style={{ color: MUTED }}>{item.sublabel}</div>}
          <span className={`mt-2 inline-flex ${statusChipCx(item.status)}`}>{statusLabel(item.status)}</span>
          {(item.onDuplicate || item.onDelete) && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700 pt-2.5">
              {item.onDuplicate && (
                <button type="button" onClick={e => { e.stopPropagation(); item.onDuplicate!(); }}
                  className="flex items-center gap-1 text-xs font-bold" style={{ color: NAVY }}>
                  <Copy size={12} />Duplicate
                </button>
              )}
              {item.onDuplicate && item.onDelete && <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-600" />}
              {item.onDelete && (
                <button type="button" disabled={item.deleteDisabled} onClick={e => { e.stopPropagation(); item.onDelete!(); }}
                  className="flex items-center gap-1 text-xs font-bold text-red-600 disabled:opacity-40 disabled:pointer-events-none dark:text-red-300">
                  <Trash2 size={12} />Delete
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={onAddWall}
        className="flex min-w-[110px] shrink-0 snap-start flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-white px-3 py-3 text-center active:scale-95 transition-all dark:bg-slate-800"
        style={{ borderColor: BLUE }}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-50 dark:bg-blue-900/55">
          <Plus size={16} style={{ color: BLUE }} />
        </span>
        <span className="text-xs font-bold" style={{ color: BLUE }}>Add wall</span>
      </button>
      </div>
      {canScrollRight && (
        <button type="button" onClick={() => scrollByStep(1)} aria-label="Scroll to next"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1/2 grid h-7 w-7 place-items-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-md active:scale-95 transition-all">
          <ChevronRight size={14} style={{ color: BLUE }} />
        </button>
      )}
    </div>
  </div>
  );
};

// --- Metrics grid ----------------------------------------------
// SheetHeaderPhone (the title/crumb/status header this used to sit under)
// was removed -- it duplicated the wall/kit card carousel directly above it
// (estimateStructureNav.tsx) plus the Panel Schedule/Orientation/Panel
// configuration sections further down. This grid stays: it's independently
// reused by estimateResultsCard.tsx's phone Overview stats.
export const MetricsGridPhone = ({ stats }: { stats: { value: string | number; label: string }[] }) => (
  <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
    {stats.map((s, i) => (
      <div key={i} className={`px-2 text-center ${i >= 3 ? "mt-3 border-t border-slate-100 dark:border-slate-700 pt-3" : ""}`}>
        <div className="text-base font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">{s.label}</div>
      </div>
    ))}
  </div>
);

// --- Sticky bottom bar (tiled) -------------------------------------------------
export const StickyBarTilesPhone = ({ stats, onReviewOrder, lineItemCount }: {
  stats: { value: string | number; label: string }[]; onReviewOrder: () => void; lineItemCount?: number;
}) => (
  <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1fr_1.3fr] gap-2 border-t border-slate-200 dark:border-slate-600 bg-white/95 dark:bg-slate-800/95 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:shadow-[0_-20px_40px_-24px_rgba(0,0,0,0.5)]">
    {stats.slice(0, 2).map((s, i) => (
      <div key={i} className="flex min-h-[50px] flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
        <div className="text-sm font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">{s.label}</div>
      </div>
    ))}
    <button onClick={onReviewOrder} className="rounded-xl text-sm font-bold text-white transition-colors active:scale-[0.99]" style={{ background: BLUE }}>
      Review order{typeof lineItemCount === "number" ? ` · ${lineItemCount}` : ""}
    </button>
  </div>
);
