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

// Cyan tint for the External-wall add-tile -- same tone as the "info"/Custom
// status chip (tone("info")), used here as raw classes since AddTile needs
// separate icon-badge/border colours, not a single badge background.
const EXTERNAL_ICON_CX = "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400";
const EXTERNAL_BORDER_CX = "border-cyan-200 dark:border-cyan-900/60";

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
  projectName, results, kits, addBlankWall, onAddExternalWall,
}: {
  projectName?: string;
  results: WallResult[]; kits: KitEntry[];
  addBlankWall: () => void;
  // Adds a wall then switches the whole project over to the External
  // calculator -- see App.tsx's addExternalWall (no per-wall internal/
  // external flag exists, External-ness is a project-level system choice).
  onAddExternalWall: () => void;
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
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <AddTile label="Internal Wall" sublabel="Add a new internal estimate" onClick={addBlankWall} />
        <AddTile label="External Wall" sublabel="Add a weather-exposed wall" onClick={onAddExternalWall} external />
      </div>
    </div>
  );
};

const AddTile = ({ label, sublabel, onClick, external = false }: {
  label: string; sublabel: string; onClick: () => void; external?: boolean;
}) => (
  <button onClick={onClick}
    className={`flex min-h-[76px] items-center gap-2.5 rounded-xl border bg-white dark:bg-slate-800 px-3 py-2.5 text-left shadow-sm active:scale-95 transition-all ${external ? EXTERNAL_BORDER_CX : ""}`}
    style={external ? undefined : { borderColor: BLUE }}>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-base font-black leading-none ${external ? EXTERNAL_ICON_CX : ""}`}
      style={external ? undefined : { background: BLUE, color: WHITE }}>+</span>
    <span className="min-w-0">
      <span className="block text-[13px] font-bold leading-tight" style={{ color: NAVY }}>{label}</span>
      <span className="mt-0.5 block text-[10px] leading-tight text-slate-400 dark:text-slate-500">{sublabel}</span>
    </span>
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
