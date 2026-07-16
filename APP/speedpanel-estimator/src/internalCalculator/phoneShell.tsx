// =============================================================================
// Phone shell (Internal Calculator only)
// =============================================================================
// Presentational components for Internal Calculator's phone layout, restyled
// to match the SpeedHub phone-estimator mockup: a "command card" (project
// name, autosave note, action-count health pill, Wall+Internal/Wall+External
// add tiles), a wall/kit rail, a "selected wall" header with a 4-stat row,
// and a slim sticky bottom bar. Deliberately forked from the shared
// ItemPillScroller/StatsGrid/StickyBar components (rather than edited in
// place) so External Calculator's phone view -- which still uses those
// shared components -- is untouched. See kitWorkspacePhone.tsx for the same
// fork-not-branch precedent.
// =============================================================================
import { cx, tone, BLUE, NAVY, MUTED, type StatusTone } from "../styleTokens";
import { plural } from "../estimate/computeUtils";
import { r1 } from "../estimate/mathUtils";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";
import type { KitEntry } from "../estimate/synthesizeKits";

// --- Derived item status ------------------------------------------------------
// No persisted "status" field exists on Wall/KitEntry -- this derives a
// mockup-style status chip from fields that already exist, so it can't drift
// out of sync with the actual compute/link state.
export type ItemStatusKey = "complete" | "needsInput" | "custom" | "linked" | "notLinked";

const STATUS: Record<ItemStatusKey, { label: string; tone: StatusTone }> = {
  complete:   { label: "Ready",       tone: "ok" },
  needsInput: { label: "Needs input", tone: "danger" },
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

/** Count of walls that still need attention -- shared by the command card's
 * health pill and the sticky bottom bar so the two numbers can't drift. */
export const countActionsNeeded = (results: WallResult[]): number =>
  results.filter(r => !isConfigured(deriveWallStatus(r.wall, r.out))).length;

// --- Command card --------------------------------------------------------------
export const CommandCardPhone = ({
  projectName, results, kits, addBlankWall, onSwitchToExternal,
}: {
  projectName?: string;
  results: WallResult[]; kits: KitEntry[];
  addBlankWall: () => void; onSwitchToExternal: () => void;
}) => {
  const totalItems = results.length + kits.length;
  const actionsNeeded = countActionsNeeded(results);

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-base" style={{ background: "rgba(0,103,185,0.1)", color: BLUE }}>▦</span>
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold" style={{ color: NAVY }}>{projectName ?? "Draft estimate"}</div>
            <div className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
              {totalItems} wall{plural(totalItems)} &amp; kits &middot; autosaved
            </div>
          </div>
        </div>
        {actionsNeeded > 0 && (
          <span className={`shrink-0 ${cx.badge} ${tone("danger")}`}>{actionsNeeded} action{plural(actionsNeeded)}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <AddTile label="Wall + Internal" sublabel="Standard, corner or shaft" variant="primary" onClick={addBlankWall} />
        <AddTile label="Wall + External" sublabel="Weather-exposed P78" variant="accent" onClick={onSwitchToExternal} />
      </div>
    </div>
  );
};

const AddTile = ({ label, sublabel, variant, onClick }: { label: string; sublabel: string; variant: "primary" | "accent"; onClick: () => void }) => (
  <button onClick={onClick}
    className="flex min-h-[68px] flex-col items-start justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-left shadow-sm active:scale-95 transition-all">
    <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm font-black leading-none text-white ${variant === "accent" ? "bg-cyan-600 dark:bg-cyan-500" : ""}`}
      style={variant === "primary" ? { background: BLUE } : undefined}>+</span>
    <span>
      <span className="block text-xs font-bold leading-tight" style={{ color: NAVY }}>{label}</span>
      <span className="mt-0.5 block text-[10px] leading-tight" style={{ color: MUTED }}>{sublabel}</span>
    </span>
  </button>
);

// --- Wall/kit pill strip -------------------------------------------------------
export interface PhonePillItem { id: string; eyebrow?: string; label: string; sublabel?: string; active: boolean; status: ItemStatusKey; }

export const WallPillStripPhone = ({ items, onSelect }: {
  items: PhonePillItem[]; onSelect: (id: string) => void;
}) => (
  <div className="-mx-1 mt-3 flex snap-x gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
    {items.map(item => (
      <button key={item.id} onClick={() => onSelect(item.id)}
        className={"min-w-[172px] shrink-0 snap-start rounded-2xl border bg-white dark:bg-slate-800 px-3.5 py-3 text-left active:scale-95 transition-all " +
          (item.active ? "border-2" : "border-slate-200 dark:border-slate-700")}
        style={item.active ? { borderColor: BLUE, boxShadow: `0 0 0 2px rgba(0,103,185,0.12)` } : undefined}>
        <div className="flex items-center justify-between gap-2">
          {item.eyebrow && <span className="text-[9px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{item.eyebrow}</span>}
          <span className={statusChipCx(item.status)}>{statusLabel(item.status)}</span>
        </div>
        <div className="mt-1.5 truncate text-sm font-bold" style={{ color: NAVY }}>{item.label}</div>
        {item.sublabel && <div className="mt-0.5 truncate text-xs font-medium" style={{ color: MUTED }}>{item.sublabel}</div>}
      </button>
    ))}
  </div>
);

// --- Sheet header + metrics grid ----------------------------------------------
export const MetricsGridPhone = ({ stats, columns = 3 }: { stats: { value: string | number; label: string }[]; columns?: 3 | 4 }) => (
  <div className={columns === 4 ? "grid grid-cols-4 gap-1" : "grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800"}>
    {stats.map((s, i) => (
      <div key={i} className={columns === 4 ? "text-center" : `px-2 text-center ${i >= 3 ? "mt-3 border-t border-slate-100 dark:border-slate-800 pt-3" : ""}`}>
        <div className="text-base font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</div>
      </div>
    ))}
  </div>
);

export const SheetHeaderPhone = ({ title, crumb, status, stats, statsColumns = 3 }: {
  title: string; crumb: string; status: ItemStatusKey;
  stats: { value: string | number; label: string }[]; statsColumns?: 3 | 4;
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Selected wall</div>
        <div className="mt-0.5 truncate text-lg font-extrabold" style={{ color: NAVY }}>{title}</div>
        <div className="mt-0.5 truncate text-xs font-medium text-slate-400 dark:text-slate-500">{crumb}</div>
      </div>
      <span className={`shrink-0 ${statusChipCx(status)}`}>{statusLabel(status)}</span>
    </div>
    <div className="mt-3.5"><MetricsGridPhone stats={stats} columns={statsColumns} /></div>
  </div>
);

// --- Sticky bottom bar -----------------------------------------------------------
export const StickyBarPhone = ({ areaLabel, panelsLabel, materialLines, actionsCount, onReviewOrder }: {
  areaLabel: string; panelsLabel: string; materialLines: number; actionsCount: number; onReviewOrder: () => void;
}) => (
  <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-20px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur dark:shadow-[0_-20px_40px_-24px_rgba(0,0,0,0.5)]">
    <div className="min-w-0 flex-1">
      <div className="text-[9px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Live project order</div>
      <div className="truncate text-sm font-extrabold" style={{ color: NAVY }}>{areaLabel} &middot; {panelsLabel}</div>
      <div className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">
        {materialLines} material line{plural(materialLines)} &middot; {actionsCount} action{plural(actionsCount)}
      </div>
    </div>
    <button onClick={onReviewOrder} className="shrink-0 rounded-xl px-5 py-3 text-sm font-bold text-white transition-colors active:scale-[0.99]" style={{ background: BLUE }}>
      Review order
    </button>
  </div>
);

// --- Live wall result ----------------------------------------------------------
// The mockup's "Live wall result" card -- one wall's own order quantity plus
// stock/C-track/fixings, all read straight off the real compute output
// (out.chosen's PanelGroup[], out.cPieces, out.boxes30/16). Summed across
// out.chosen.groups rather than picked from a single group, since a wall can
// legitimately span more than one stock length.
export const LiveWallResultPhone = ({ out }: { out: ComputeOut }) => {
  if (out.empty || !out.chosen || out.chosen.invalid) {
    return (
      <div className={`mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center text-sm text-slate-400 dark:text-slate-500`}>
        Enter dimensions to see the live result
      </div>
    );
  }
  const groups = out.chosen.groups;
  const required = groups.reduce((a, g) => a + g.pieces, 0);
  const ordered = groups.reduce((a, g) => a + g.ordered, 0);
  const spare = ordered - required;
  const packs = groups.reduce((a, g) => a + g.packs, 0);
  const stockLabel = groups.length === 1 ? `${r1(groups[0].stock)} m` : "Mixed lengths";
  const fixingsBoxes = (out.boxes30 || 0) + (out.boxes16 || 0);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(0,103,185,0.25)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "rgba(0,103,185,0.2)", background: "rgba(0,103,185,0.04)" }}>
        <span className="text-sm font-bold" style={{ color: NAVY }}>Live wall result</span>
        <span className="ml-auto text-[10px] font-bold" style={{ color: BLUE }}>Recalculates instantly</span>
      </div>
      <div className="grid grid-cols-[1.15fr_.85fr]">
        <div className="border-r p-4" style={{ borderColor: "rgba(0,103,185,0.2)" }}>
          <div className="text-[9px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">Order quantity</div>
          <div className="mt-1 text-[28px] font-extrabold leading-none tracking-tight" style={{ color: NAVY }}>{ordered}</div>
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">{required} required &middot; {packs} pack{plural(packs)} &middot; {spare} spare</p>
        </div>
        <div className="space-y-2 p-3">
          <Row2 k="Stock" v={stockLabel} />
          <Row2 k="C-track" v={`${out.cPieces || 0} length${plural(out.cPieces || 0)}`} />
          <Row2 k="Fixings" v={`${fixingsBoxes} box${plural(fixingsBoxes)}`} />
        </div>
      </div>
      {spare > 0 && (
        <div className="mx-3 mb-3 flex gap-2 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs leading-relaxed text-red-700 dark:text-red-400">
          <span>!</span>
          <span>
            <span className="block font-bold">Pack rounding adds {spare} spare panel{plural(spare)}</span>
            This is within the current project waste setting.
          </span>
        </div>
      )}
    </div>
  );
};

const Row2 = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 py-1.5 text-xs last:border-0">
    <span className="text-slate-400 dark:text-slate-500">{k}</span>
    <span className="font-bold" style={{ color: NAVY }}>{v}</span>
  </div>
);
