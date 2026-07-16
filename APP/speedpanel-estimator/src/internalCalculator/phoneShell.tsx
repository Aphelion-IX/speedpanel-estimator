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
import { cx, tone, BLUE, NAVY, MUTED, WHITE, type StatusTone } from "../styleTokens";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";
import type { KitEntry } from "../estimate/synthesizeKits";

// --- Derived item status ------------------------------------------------------
// No persisted "status" field exists on Wall/KitEntry -- this derives a
// mockup-style status chip from fields that already exist, so it can't drift
// out of sync with the actual compute/link state.
export type ItemStatusKey = "complete" | "needsInput" | "custom" | "linked" | "notLinked";

const STATUS: Record<ItemStatusKey, { label: string; tone: StatusTone }> = {
  complete:   { label: "Complete",    tone: "ok" },
  needsInput: { label: "Needs input", tone: "warn" },
  custom:     { label: "Custom",      tone: "info" },
  linked:     { label: "Linked",      tone: "ok" },
  notLinked:  { label: "Not linked",  tone: "danger" },
};

export const statusLabel = (key: ItemStatusKey) => STATUS[key].label;
export const statusChipCx = (key: ItemStatusKey) => `${cx.badge} ${tone(STATUS[key].tone)}`;
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

// --- Project card ------------------------------------------------------------
export const ProjectCardPhone = ({
  projectName, results, kits, addBlankWall, addCornerWall, addShaftWall,
}: {
  projectName?: string;
  results: WallResult[]; kits: KitEntry[];
  addBlankWall: () => void; addCornerWall: () => void; addShaftWall: () => void;
}) => {
  const totalItems = results.length + kits.length;
  const configuredCount = results.filter(r => isConfigured(deriveWallStatus(r.wall, r.out))).length + kits.length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length + kits.filter(k => k.result.warnings.length > 0).length;
  const pct = totalItems ? Math.round((configuredCount / totalItems) * 100) : 0;

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-extrabold" style={{ color: NAVY }}>{projectName ?? "Draft estimate"}</div>
          <div className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            {pct}% configured · {warningsCount} warning{warningsCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="shrink-0 text-xs font-medium text-slate-400 dark:text-slate-500">
          {totalItems} item{totalItems === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BLUE }} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <AddTile label="Add Wall" onClick={addBlankWall} />
        <AddTile label="Add Corner" onClick={addCornerWall} />
        <AddTile label="Add Shaft" onClick={addShaftWall} />
      </div>
    </div>
  );
};

const AddTile = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border bg-white dark:bg-slate-800 px-2 py-2.5 text-center shadow-sm active:scale-95 transition-all"
    style={{ borderColor: BLUE }}>
    <span className="grid h-6 w-6 place-items-center rounded-lg text-sm font-black leading-none" style={{ background: BLUE, color: WHITE }}>+</span>
    <span className="text-[11px] font-bold leading-tight" style={{ color: NAVY }}>{label}</span>
  </button>
);

// --- Wall/kit pill strip -------------------------------------------------------
export interface PhonePillItem { id: string; label: string; sublabel?: string; active: boolean; status: ItemStatusKey; }

export const WallPillStripPhone = ({ items, onSelect }: {
  items: PhonePillItem[]; onSelect: (id: string) => void;
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({items.length})</div>
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onSelect(item.id)}
          className={"min-w-[168px] shrink-0 snap-start rounded-xl border bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all " +
            (item.active ? "border-2 shadow-[0_0_0_2px_rgba(0,103,185,0.12)]" : "border-slate-200 dark:border-slate-700")}
          style={item.active ? { borderColor: BLUE } : undefined}>
          <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{item.label}</div>
          {item.sublabel && <div className="mt-1 truncate text-xs font-medium" style={{ color: MUTED }}>{item.sublabel}</div>}
          <span className={`mt-2 inline-flex ${statusChipCx(item.status)}`}>{statusLabel(item.status)}</span>
        </button>
      ))}
    </div>
  </div>
);

// --- Sheet header + metrics grid ----------------------------------------------
export const MetricsGridPhone = ({ stats }: { stats: { value: string | number; label: string }[] }) => (
  <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
    {stats.map((s, i) => (
      <div key={i} className={`px-2 text-center ${i >= 3 ? "mt-3 border-t border-slate-100 dark:border-slate-800 pt-3" : ""}`}>
        <div className="text-base font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</div>
      </div>
    ))}
  </div>
);

export const SheetHeaderPhone = ({ title, crumb, status, stats }: {
  title: string; crumb: string; status: ItemStatusKey;
  stats: { value: string | number; label: string }[];
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold" style={{ color: NAVY }}>{title}</div>
        <div className="mt-0.5 truncate text-xs font-medium text-slate-400 dark:text-slate-500">{crumb}</div>
      </div>
      <span className={`shrink-0 ${statusChipCx(status)}`}>{statusLabel(status)}</span>
    </div>
    <div className="mt-3.5"><MetricsGridPhone stats={stats} /></div>
  </div>
);

// --- Sticky bottom bar (tiled) -------------------------------------------------
export const StickyBarTilesPhone = ({ stats, onReviewOrder, lineItemCount }: {
  stats: { value: string | number; label: string }[]; onReviewOrder: () => void; lineItemCount?: number;
}) => (
  <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-[1fr_1fr_1.3fr] gap-2 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:shadow-[0_-20px_40px_-24px_rgba(0,0,0,0.5)]">
    {stats.slice(0, 2).map((s, i) => (
      <div key={i} className="flex min-h-[50px] flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="text-sm font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</div>
      </div>
    ))}
    <button onClick={onReviewOrder} className="rounded-xl text-sm font-bold text-white transition-colors active:scale-[0.99]" style={{ background: BLUE }}>
      Review order{typeof lineItemCount === "number" ? ` · ${lineItemCount}` : ""}
    </button>
  </div>
);
