// =============================================================================
// Shared UI primitives
// =============================================================================
// Small, cross-feature presentational atoms used by both the Internal and
// External calculators (and by other pages) -- layout grid, section labels,
// numeric/unit/toggle inputs, stat cards, notes/lock lines, generic
// title-card/row wrappers, the mode/warnings banners, and the sidebar/main
// layout shell both calculators compose their content into. No dependency on
// Wall or the compute engine; pure props in, JSX out.
// =============================================================================
import { useState } from "react";
import { r1 } from "../estimate/mathUtils";
import { cx, BLUE, GOLD, WHITE, NAVY, MUTED } from "../styleTokens";
import type { EffectiveLayout } from "../useLayoutMode";
import { AlertTriangle, ChevronDown } from "lucide-react";

// --- IconButton -------------------------------------------------------------
// The header's square icon-only button shape (bell/theme/layout/reset/
// hamburger/sign-in) -- was a repeated literal className in each of those
// components; shared here so they can't drift out of sync with each other.
//
// Also the app-wide bordered icon button for utility actions (Save/Edit/
// Delete/Retry) -- `size="lg"` (40px, the default, matches the original
// header shape exactly) for standalone toolbar-level actions, `size="sm"`
// (32px) for repeated row actions in dense tables; `variant="danger"` tints
// the border/hover red for destructive actions like Delete.
export const IconButton = ({ onClick, title, ariaLabel, className = "", variant = "default", size = "lg", disabled = false, children }: {
  onClick?: () => void; title?: string; ariaLabel?: string; className?: string;
  variant?: "default" | "danger"; size?: "lg" | "sm"; disabled?: boolean; children: React.ReactNode;
}) => {
  const sizeCx = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const variantCx = variant === "danger"
    ? "border-red-100 dark:border-red-800/60 text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700"
    : "border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600";
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      disabled={disabled}
      className={`grid place-items-center border bg-white dark:bg-slate-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 disabled:hover:shadow-sm ${sizeCx} ${variantCx} ${className}`}
    >
      {children}
    </button>
  );
};

// --- CardGrid -------------------------------------------------------------
// On web layout, arranges its children (cards) side by side in a responsive
// grid instead of one full-width stacked column -- fixes cards stretching to
// the whole (~1000px) main column with sparse, empty-feeling rows, and keeps
// the main column from growing far taller than the sticky sidebar when
// several cards/wall breakdowns are shown at once. auto-fit/minmax means it
// gracefully drops to fewer columns (down to 1) on a narrower web viewport,
// rather than a fixed column count. On phone layout this renders children
// exactly as before (no wrapper), so phone output is byte-identical.
//
// Margin ownership: a grid container blocks normal margin collapsing at its
// boundary (unlike a plain block sibling), so relying on each child's own
// baked-in mt-3 (as every card component does, for normal block-flow
// stacking on phone) produces MORE visible gap on web than phone -- the
// preceding heading's mb-2 no longer collapses away into the child's larger
// mt-3, it just adds on top of it. Fix: the grid container itself carries
// mt-3 (so it collapses normally with whatever precedes it, exactly like a
// plain card would), gap-3 provides uniform row/column spacing, and
// [&>*]:!mt-0 neutralizes each child's own top margin so it can't ALSO
// contribute -- one spacing source instead of two independent ones.
export const CardGrid = ({ layoutMode, minWidth = 320, stretch = false, children }: {
  layoutMode: EffectiveLayout; minWidth?: number; stretch?: boolean; children: React.ReactNode;
}) => (
  layoutMode === "web"
    // stretch: rows size to their tallest card and every card fills that height (via
    // items-stretch + each card's own h-full) -- opt-in since most existing callers
    // want each card's natural content height (items-start), not equalized rows.
    ? <div className={`mt-3 grid gap-3 [&>*]:!mt-0 ${stretch ? "items-stretch" : "items-start"}`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}>{children}</div>
    : <>{children}</>
);

// --- UI primitives ------------------------------------------------------------
export const SectionLabel = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className={cx.sectionLbl}>
    <span style={{ color: BLUE }}>{icon}</span>{children}
  </div>
);

// --- CollapsibleSection -----------------------------------------------------
// Same header/chevron visual language as the "Wall estimate" accordion
// (cx.accordion) and SpanTable's inline accordion, generalized into a
// sidebar section header that can be toggled shut -- used to shrink the
// sidebar's default rendered height (Wall geometry stays open, Tracks and
// flashing starts closed) so the sticky sidebar isn't routinely taller than
// the main column it sits beside.
export const CollapsibleSection = ({ icon, label, defaultOpen = true, children }: {
  icon: React.ReactNode; label: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <button onClick={() => setOpen(v => !v)} className={`${cx.sectionLbl} w-full justify-between`}>
        <span className="flex items-center gap-2"><span style={{ color: BLUE }}>{icon}</span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children}
    </>
  );
};

export const Num = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <label className={cx.lbl}>{label}</label>
    <input type="number" inputMode="decimal" value={value}
      onChange={e => onChange(e.target.value)}
      className={`${cx.input} font-medium`} style={{ color: NAVY }} />
  </div>
);

export const UnitToggle = ({ unit, setUnit }: { unit: string; setUnit: (u: string) => void }) => (
  <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-bold shadow-sm">
    {["m", "mm"].map(u => (
      <button key={u} onClick={() => setUnit(u)}
        className={`w-11 py-2 text-center transition-all ${unit === u ? "" : "bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400"}`}
        style={unit === u ? { background: BLUE, color: WHITE } : undefined}>{u}</button>
    ))}
  </div>
);

/** Animated toggle switch pill */
export const ToggleSwitch = ({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) => (
  <button onClick={onToggle}
    className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors"
    style={{ color: active ? BLUE : MUTED }}>
    <span>{label}</span>
    <span style={{
      display: "inline-flex", width: 32, height: 18, borderRadius: 9,
      background: active ? BLUE : MUTED,
      boxShadow: active ? `0 0 0 4px color-mix(in srgb, ${BLUE} 14%, transparent), inset 0 1px 1px rgba(255,255,255,0.25)` : "inset 0 1px 2px rgba(12,35,64,0.15)",
      position: "relative", flexShrink: 0, transition: "background 0.2s, box-shadow 0.2s",
    }}>
      <span style={{
        position: "absolute", top: 2, width: 14, height: 14, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        left: active ? 16 : 2, transition: "left 0.2s",
      }} />
    </span>
  </button>
);

/** Three-up stats grid: m2 / panels / type */
export const StatsRow = ({ area, panels, panelType }: { area: string | number; panels: string | number; panelType: string }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    <Stat value={area}      label="Total m2" />
    <Stat value={panels}    label="Panels" />
    <Stat value={panelType} label="Panel type" />
  </div>
);

/** Italic notes list shown below results */
export const NotesList = ({ notes }: { notes?: string[] | null }) => {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/40 p-3.5">
      {notes.map((n, i) => (
        <p key={i} className="flex gap-2 text-sm leading-relaxed text-slate-500 dark:text-slate-300">
          <span style={{ color: BLUE }}>›</span>{n}
        </p>
      ))}
    </div>
  );
};

/** "All N walls locked to X m" confirmation line */
export const ProjectLockNote = ({ wallCount, stock, dimUnit, numM, customActive }: {
  wallCount: number; stock: string; dimUnit: string; numM?: number; customActive?: boolean;
}) => {
  const display = customActive && numM
    ? (dimUnit === "mm" ? `${Math.round(numM * 1000)} mm` : `${r1(numM)} m`)
    : `${r1(parseFloat(stock))} m`;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: BLUE }}>
      <span>›</span> All {wallCount} wall{wallCount !== 1 ? "s" : ""} locked to {display}
    </p>
  );
};

export const Stat = ({ value, label }: { value: string | number; label: string }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-4 text-center shadow-sm" style={{ borderTop: `2px solid ${GOLD}` }}>
    <div className="text-xl font-extrabold leading-none tracking-tight" style={{ color: BLUE }}>{value}</div>
    <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">{label}</div>
  </div>
);

/** Arbitrary-length stats grid (unlike StatsRow's fixed 3) -- for contexts
 * needing more than area/panels/type at once, e.g. a project-wide overview
 * (area, panels, wall count, kit count, waste%, warnings). */
export const StatsGrid = ({ stats }: { stats: { value: string | number; label: string }[] }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 items-end gap-1.5">
    {stats.map((s, i) => <Stat key={i} value={s.value} label={s.label} />)}
  </div>
);

export const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className={`mt-3 ${cx.card}`}>
    <div className={cx.cardTitle} style={{ color: NAVY }}>
      <span style={{ color: BLUE }}>{icon}</span>{title}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

export const Row = ({ k, v, dim, hl }: { k: string; v: string | number; dim?: boolean; hl?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 py-0.5">
    <span className={dim ? cx.rowKeyDim : cx.rowKey}>{k}</span>
    <span className={cx.rowVal} style={{ color: hl ? BLUE : dim ? MUTED : NAVY }}>{v}</span>
  </div>
);

// --- AccordionCard --------------------------------------------------------
// cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
// mt-3 provides the top gap instead, since this card is a CardGrid item and needs
// consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
export const AccordionCard = ({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>{summary}</span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
};
// --- EstimateModeSelector -----------------------------------------------------
export const EstimateModeSelector = ({ visible, mode, setMode }: { visible: boolean; mode: string; setMode: (m: string) => void }) => {
  if (!visible) return null;
  return (
    <div className="mt-4 grid grid-cols-2 items-end gap-2">
      {[["single","Selected wall estimate"],["project","Combined wall estimate"]].map(([k, lbl]) => {
        const on = mode === k;
        return (
          <button key={k} onClick={() => setMode(k)}
            className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800")}
            style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
        );
      })}
    </div>
  );
};

// --- WarningsList -------------------------------------------------------------
export const WarningsList = ({ warnings }: { warnings?: string[] | null }) => {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-5 space-y-3">
      {warnings.map((w, i) => (
        <div key={i} className={cx.warnbox}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-300" /><span>{w}</span>
        </div>
      ))}
    </div>
  );
};
// --- CalculatorShell --------------------------------------------------------
// Composes the same sidebar/main/footer content differently depending on
// layout mode. Phone reproduces today's stacked order exactly (byte-for-byte
// equivalent JSX, just relocated into variables); web arranges it as a sticky
// sidebar + wider main column.
export const CalculatorShell = ({ sidebar, main, footer, sidebarWidth = 400 }: {
  sidebar: React.ReactNode; main: React.ReactNode; footer: React.ReactNode;
  sidebarWidth?: number; // narrower once a sidebar is nav-only (see InternalCalculator's Estimate Structure nav) -- default keeps every existing caller byte-identical
}) => (
  // No space-y-* here: every child component already carries its own correct
  // top margin (mt-3/mt-5/etc., matching phone layout exactly). space-y-*'s
  // generated selector (> :not([hidden]) ~ :not([hidden])) has HIGHER CSS
  // specificity than a plain utility class like mt-5, so it was silently
  // overriding every child's real margin down to a flat 4px -- the actual
  // cause of web layout's spacing looking compressed/inconsistent vs phone.
  <div className="grid items-start gap-8" style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}>
    <aside className="sticky top-5">{sidebar}</aside>
    <div className="min-w-0">{main}{footer}</div>
  </div>
);

