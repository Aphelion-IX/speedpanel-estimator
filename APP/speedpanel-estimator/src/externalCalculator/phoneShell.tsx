// =============================================================================
// Phone shell (External Calculator only)
// =============================================================================
// Presentational components for External Calculator's phone layout, mirroring
// internalCalculator/phoneShell.tsx's mockup-matched visual language (project
// summary card with add-wall tiles, restyled wall pill strip, combined
// title/crumb/status + metrics-grid header, tiled sticky bottom bar) but
// simplified for External's domain: no Corner/Shaft/kit concept at all, so
// no KitEntry, no "linked"/"notLinked" status, no kit rows in the pill strip.
//
// Deliberately its OWN copy, not imported from internalCalculator/ -- kept
// fully self-contained per calculator, same reasoning as the wallsCard/
// wallConfig/lengthExplorer fork (each calculator owns everything it
// renders, so a change to one can never accidentally affect the other).
// =============================================================================
import { Layers, Copy, Trash2, Plus } from "lucide-react";
import { cx, tone, BLUE, NAVY, MUTED } from "../styleTokens";
import type { Wall, ComputeOut } from "../estimate/wall.types";

// --- Derived item status ------------------------------------------------------
// No persisted "status" field exists on Wall -- this derives a mockup-style
// status chip from fields that already exist, so it can't drift out of sync
// with the actual compute state. Narrower than Internal's ItemStatusKey --
// External has no kit-linking concept, so no "linked"/"notLinked".
//
// Colour rule (blue/neutral/cyan/red only, no yellow or gold, same as
// Internal's phone rework): tone() has no blue entry, so BLUE_CHIP_CX
// borrows the exact blue-tint classes styleTokens.ts's cx.infoBox already
// uses elsewhere, rather than inventing a new colour.
export type ItemStatusKey = "complete" | "needsInput" | "custom";

const BLUE_CHIP_CX = "bg-blue-50 dark:bg-blue-900/55 text-[color:var(--blue)]";

const STATUS: Record<ItemStatusKey, { label: string; chipCx: string }> = {
  complete:   { label: "Complete",    chipCx: BLUE_CHIP_CX },
  needsInput: { label: "Needs input", chipCx: BLUE_CHIP_CX },
  custom:     { label: "Custom",      chipCx: tone("info") },
};

export const statusLabel = (key: ItemStatusKey) => STATUS[key].label;
export const statusChipCx = (key: ItemStatusKey) => `${cx.badge} ${STATUS[key].chipCx}`;
export const isConfigured = (key: ItemStatusKey) => key !== "needsInput";

export const deriveWallStatus = (wall: Wall, out: ComputeOut): ItemStatusKey => {
  if (out.empty) return "needsInput";
  if (wall.forcedStock) return "custom";
  return "complete";
};

// --- Wall pill strip -------------------------------------------------------
// `thumbnail` (a small WallPreviewSection size="thumb") sits in its own
// backing chip above the text -- needed regardless of the pill's own
// background so the image reads the same selected or not.
export interface PhonePillItem {
  id: string; label: string; sublabel?: string; active: boolean; status: ItemStatusKey; thumbnail?: React.ReactNode;
  onDuplicate?: () => void; onDelete?: () => void; deleteDisabled?: boolean;
}

export const WallPillStripPhone = ({ items, onSelect, onAddWall }: {
  items: PhonePillItem[]; onSelect: (id: string) => void; onAddWall: () => void;
}) => (
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
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
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
  </div>
);

// --- Metrics grid ----------------------------------------------
// SheetHeaderPhone (the title/crumb/status header this used to sit under)
// was removed -- it duplicated the wall card carousel directly above it
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
