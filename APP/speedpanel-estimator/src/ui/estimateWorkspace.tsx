// =============================================================================
// Estimator workspace primitives
// =============================================================================
// Shared building blocks for the redesigned Estimator main column: a plain
// titled "workspace" card (Calculator Workspace / Project Workspace), the
// 3-tile Panels/Accessories/Warnings summary row, and a compact project-mode
// wall row card. No calculation logic lives here -- each calculator builds
// the row/tile data from its own already-computed ComputeOut/aggregate
// results and passes it in as plain props.
// =============================================================================
import { useState } from "react";
import { ChevronDown, Copy, Trash2, ClipboardList } from "lucide-react";
import { cx, BLUE, GOLD, WHITE, NAVY } from "../styleTokens";
import { IconButton, CollapsibleSection } from "./primitives";
import type { Wall } from "../estimate/wall.types";

// --- WorkspaceCard --------------------------------------------------------
// Plain titled card (no chevron/accordion) for "Calculator Workspace" /
// "Project Workspace" -- the one consolidated main-column card each mode
// renders its content into. `badge` renders a small pill in the header
// (e.g. the active wall's name).
export const WorkspaceCard = ({ title, badge, children }: {
  title: string; badge?: React.ReactNode; children: React.ReactNode;
}) => (
  <div className={cx.card}>
    <div className="mb-3.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: NAVY }}>{title}</span>
      {badge && <span className={cx.badge} style={{ background: BLUE, color: WHITE }}>{badge}</span>}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// --- Summary tiles ----------------------------------------------------------
export const SummaryTiles = ({ tiles }: { tiles: React.ReactNode[] }) => (
  <div className="mt-3 grid grid-cols-3 gap-2">{tiles}</div>
);

/** Simple non-interactive tile (Panels). */
export const MetricTile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-4 text-center shadow-sm" style={{ borderTop: `2px solid ${GOLD}` }}>
    <div className="text-xl font-extrabold leading-none tracking-tight" style={{ color: BLUE }}>{value}</div>
    <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
  </div>
);

// --- ExpandableTile -----------------------------------------------------------
// Used for Accessories and Warnings: track LM, screw box-counts and sealant
// sausage-counts are different units, so there's no honest single combined
// number -- the compact state shows a category/warning COUNT, and clicking
// expands an inline breakdown where each row keeps its own unit.
export const ExpandableTile = ({ label, compactValue, tone = "neutral", rows }: {
  label: string; compactValue: string | number; tone?: "neutral" | "warn";
  rows: { label: string; value: string }[];
}) => {
  const [open, setOpen] = useState(false);
  const flagged = tone === "warn" && rows.length > 0;
  const accent = flagged ? "#DC2626" : GOLD;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden" style={{ borderTop: `2px solid ${accent}` }}>
      <button onClick={() => setOpen(v => !v)} disabled={rows.length === 0}
        className="w-full px-2 py-4 text-center disabled:cursor-default">
        <div className="text-xl font-extrabold leading-none tracking-tight" style={{ color: flagged ? "#DC2626" : BLUE }}>{compactValue}</div>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <span>{label}</span>
          {rows.length > 0 && <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
        </div>
      </button>
      {open && rows.length > 0 && (
        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 px-3 py-2.5 text-left">
          {rows.map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{r.label}</span>
              <span className="text-right text-xs font-semibold shrink-0" style={{ color: NAVY }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- WallRowCard --------------------------------------------------------------
// Compact project-mode wall row: name, type/orientation label, W x H, panel
// count, Edit/Duplicate/Remove -- replaces the old read-only WallsSummaryTable
// as the project workspace's wall list. Edit just makes the row's wall the
// active one (same as clicking its tab in the sidebar's wall switcher).
export const WallRowCard = ({ wall, typeLabel, dimLabel, panelsLabel, active, warn, onEdit, onDuplicate, onDelete, deletable }: {
  wall: Wall; typeLabel: string; dimLabel: string; panelsLabel: string;
  active: boolean; warn?: boolean;
  onEdit: () => void; onDuplicate: () => void; onDelete: () => void; deletable: boolean;
}) => (
  <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${active ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"}`}>
    <button onClick={onEdit} className="min-w-0 flex-1 text-left">
      <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: NAVY }}>
        {warn && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: GOLD }} />}
        <span className="truncate">{wall.name}</span>
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-slate-400 dark:text-slate-500">{typeLabel} · {dimLabel} · {panelsLabel}</div>
    </button>
    <div className="flex shrink-0 items-center gap-1.5">
      <IconButton onClick={onDuplicate} size="sm" title="Duplicate"><Copy size={13} /></IconButton>
      <IconButton onClick={onDelete} size="sm" variant="danger" disabled={!deletable} title="Remove"><Trash2 size={13} /></IconButton>
    </div>
  </div>
);

// --- ExpandableOrderDetails -----------------------------------------------------
// Single collapsible region (closed by default) holding the full existing
// breakdown -- panel schedule, stock/pack notes, tracks/connection materials,
// sealant/fixing counts, per-wall warnings/assumptions. Replaces the previous
// iteration's SectionNav (jump-nav across always-visible/tab-navigated
// sections) per the mockup's "no separate Wall List / Breakdown / Connections
// / Order / Fixings buttons" direction -- same underlying section components,
// just nested under one toggle instead of shown side by side.
export const ExpandableOrderDetails = ({ children }: { children: React.ReactNode }) => (
  <CollapsibleSection icon={<ClipboardList size={13} />} label="Order details" defaultOpen={false}>
    <div className="space-y-5">{children}</div>
  </CollapsibleSection>
);
