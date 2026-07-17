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
import { cx, tone, BLUE, NAVY, MUTED, WHITE } from "../styleTokens";
import type { Wall, WallResult, ComputeOut } from "../estimate/wall.types";

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

const BLUE_CHIP_CX = "bg-blue-50 dark:bg-blue-950/40 text-[color:var(--blue)]";

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

// --- Project card ------------------------------------------------------------
export const ProjectCardPhone = ({
  projectName, results, addBlankWall, onAddInternalWall,
}: {
  projectName?: string;
  results: WallResult[];
  addBlankWall: () => void;
  // Adds a wall then switches the whole project over to the Internal
  // calculator -- see App.tsx's addInternalWall (no per-wall internal/
  // external flag exists, Internal-ness is a project-level system choice).
  // Mirror image of Internal's own onAddExternalWall.
  onAddInternalWall: () => void;
}) => {
  const totalItems = results.length;
  const configuredCount = results.filter(r => isConfigured(deriveWallStatus(r.wall, r.out))).length;
  const warningsCount = results.filter(r => r.out.warnings.length > 0).length;
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
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BLUE }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <AddTile label="External Wall" sublabel="Add a weather-exposed wall" onClick={addBlankWall} external />
        <AddTile label="Internal Wall" sublabel="Add a new internal estimate" onClick={onAddInternalWall} />
      </div>
    </div>
  );
};

// External tile's icon badge reuses tone("info") -- the same cyan classes
// already backing the Custom status chip -- rather than hand-rolled cyan
// classes; its border stays the same neutral slate every other unselected
// card in the app uses (no cyan border token exists in styleTokens.ts to
// borrow instead).
const AddTile = ({ label, sublabel, onClick, external = false }: {
  label: string; sublabel: string; onClick: () => void; external?: boolean;
}) => (
  <button onClick={onClick}
    className={`flex min-h-[76px] items-center gap-2.5 rounded-xl border bg-white dark:bg-slate-800 px-3 py-2.5 text-left shadow-sm active:scale-95 transition-all ${external ? "border-slate-200 dark:border-slate-700" : ""}`}
    style={external ? undefined : { borderColor: BLUE }}>
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-base font-black leading-none ${external ? tone("info") : ""}`}
      style={external ? undefined : { background: BLUE, color: WHITE }}>+</span>
    <span className="min-w-0">
      <span className="block text-[13px] font-bold leading-tight" style={{ color: NAVY }}>{label}</span>
      <span className="mt-0.5 block text-[10px] leading-tight text-slate-400 dark:text-slate-500">{sublabel}</span>
    </span>
  </button>
);

// --- Wall pill strip -------------------------------------------------------
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
  <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
    {stats.map((s, i) => (
      <div key={i} className={`px-2 text-center ${i >= 3 ? "mt-3 border-t border-slate-100 dark:border-slate-800 pt-3" : ""}`}>
        <div className="text-base font-extrabold" style={{ color: NAVY }}>{s.value}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</div>
      </div>
    ))}
  </div>
);

// No self-wrapping card (mt-3/cx.section) -- nested flush as the first two
// blocks of SheetCardPhone (see phoneSections.tsx), matching the mockup's
// single continuous "sheet". Only consumer is ExternalCalculator.tsx.
export const SheetHeaderPhone = ({ title, crumb, status, stats }: {
  title: string; crumb: string; status: ItemStatusKey;
  stats: { value: string | number; label: string }[];
}) => (
  <>
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-4">
      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold" style={{ color: NAVY }}>{title}</div>
        <div className="mt-0.5 truncate text-xs font-medium text-slate-400 dark:text-slate-500">{crumb}</div>
      </div>
      <span className={`shrink-0 ${statusChipCx(status)}`}>{statusLabel(status)}</span>
    </div>
    <div className="border-b border-slate-100 dark:border-slate-800 px-2 py-3.5">
      <MetricsGridPhone stats={stats} />
    </div>
  </>
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
