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
import { Layers } from "lucide-react";
import { cx, tone, BLUE, NAVY, MUTED } from "../styleTokens";
import type { Wall, ComputeOut } from "../estimate/wall.types";

// --- Derived item status ------------------------------------------------------
// No persisted "status" field exists on Wall/KitEntry -- this derives a
// mockup-style status chip from fields that already exist, so it can't drift
// out of sync with the actual compute/link state.
//
// Colour rule (per the approved mockup's visual rules -- blue/neutral/cyan/
// red only, no yellow or gold): the mockup's own item-pill markup only ever
// uses 3 chip colours -- default blue (Complete/Needs input/Linked), cyan
// (Custom/special-order, `.status.cyan`), and red (Not linked, `.status.red`).
// tone() has no blue entry (its "ok"/"warn" emerald/amber cases don't exist
// in this palette), so BLUE_CHIP_CX borrows the exact blue-tint classes
// styleTokens.ts's cx.infoBox/cx.accordionInner already use elsewhere in the
// app, rather than inventing a new colour.
export type ItemStatusKey = "complete" | "needsInput" | "custom" | "linked" | "notLinked";

const BLUE_CHIP_CX = "bg-blue-50 dark:bg-blue-900/55 text-[color:var(--blue)]";

const STATUS: Record<ItemStatusKey, { label: string; chipCx: string }> = {
  complete:   { label: "Complete",    chipCx: BLUE_CHIP_CX },
  needsInput: { label: "Needs input", chipCx: BLUE_CHIP_CX },
  custom:     { label: "Custom",      chipCx: tone("info") },
  linked:     { label: "Linked",      chipCx: BLUE_CHIP_CX },
  notLinked:  { label: "Not linked",  chipCx: tone("danger") },
};

export const statusLabel = (key: ItemStatusKey) => STATUS[key].label;
export const statusChipCx = (key: ItemStatusKey) => `${cx.badge} ${STATUS[key].chipCx}`;
export const isConfigured = (key: ItemStatusKey) => key !== "needsInput" && key !== "notLinked";

// A corner/shaft wall only ever appears in `kits` once BOTH partners are
// linked (see synthesizeKits.ts) -- an unlinked corner/shaft wall instead
// shows up standalone in `results`, which is what "notLinked" surfaces here.
export const deriveWallStatus = (wall: Wall, out: ComputeOut): ItemStatusKey => {
  if (out.empty) return "needsInput";
  if ((wall.wallSystem === "corner" && !wall.cornerPartnerId) || (wall.wallSystem === "shaft" && !wall.shaftPartnerId)) return "notLinked";
  if (wall.forcedStock) return "custom";
  return "complete";
};

// --- Wall/kit pill strip -------------------------------------------------------
// `thumbnail` (a small WallPreviewSection size="thumb", or a kit icon) sits in
// its own backing chip above the text -- needed regardless of the pill's own
// background so the image reads the same selected or not.
export interface PhonePillItem { id: string; label: string; sublabel?: string; active: boolean; status: ItemStatusKey; thumbnail?: React.ReactNode; }

export const WallPillStripPhone = ({ items, onSelect }: {
  items: PhonePillItem[]; onSelect: (id: string) => void;
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className={`${cx.cardHd} flex items-center gap-1.5`} style={{ marginTop: 0 }}>
      <Layers size={12} />My Walls ({items.length})
    </div>
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(item.id)}
          className={"min-w-[190px] shrink-0 snap-start rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all " +
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
        </button>
      ))}
    </div>
  </div>
);

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
