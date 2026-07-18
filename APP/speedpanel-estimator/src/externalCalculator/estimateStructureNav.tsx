// =============================================================================
// Estimate Structure nav (External)
// =============================================================================
// Walls-only counterpart to internalCalculator/estimateStructureNav.tsx --
// External has no wallSystem/Corner/Shaft concept, so there's no kit cards or
// "+ Add corner"/"+ Add shaft" actions here, just walls + "+ Add wall".
//
// Web renders as a full-width horizontal card carousel (ui/cardCarousel.tsx)
// instead of the old narrow-sidebar text list -- each card shows its actual
// preview diagram (ui/wallPreview.tsx, size="thumb") as a thumbnail image,
// plus the workflow status pill already used on phone (deriveWallStatus) and
// the existing warning-dot bubble (a distinct signal: compute warnings, not
// workflow status). Phone keeps its own WallPillStripPhone (phoneShell.tsx),
// now also carrying a thumbnail per pill.
// =============================================================================
import { Plus } from "lucide-react";
import { cx, BLUE, NAVY, MUTED, selectableOffCx, goldBubbleFill } from "../styleTokens";
import type { Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, statusChipCx, statusLabel, type PhonePillItem } from "./phoneShell";
import { CardCarousel } from "../ui/cardCarousel";
import { WallPreviewSection } from "../ui/wallPreview";

export const EstimateStructureNav = ({ walls, results, activeId, onSelectWall, warnById, addBlankWall, layoutMode, dimUnit, toDisp, onViewAll }: {
  walls: Wall[]; results: WallResult[]; activeId: number; onSelectWall: (id: number) => void;
  warnById: Record<number, boolean>; addBlankWall: () => void; layoutMode?: EffectiveLayout;
  dimUnit: string; toDisp: (m: string) => string;
  // Opens the All Walls page (allWallsPage.tsx) -- web only, see the
  // "View all" link in the header row below.
  onViewAll: () => void;
}) => {
  if (layoutMode === "phone") {
    // Add-wall action lives on ProjectCardPhone (rendered above this nav in
    // ExternalCalculator.tsx) on phone, not as a trailing pill here --
    // mirrors internalCalculator/estimateStructureNav.tsx's phone branch.
    const items: PhonePillItem[] = results.map(({ wall: w, out: r }) => ({
      id: String(w.id),
      label: w.name,
      sublabel: `${w.orient === "vertical" ? "Vert" : "Horiz"}${r.empty ? "" : ` · ${r.area} m2`}`,
      active: w.id === activeId,
      status: deriveWallStatus(w, r),
      thumbnail: <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />,
    }));
    return <WallPillStripPhone items={items} onSelect={id => onSelectWall(Number(id))} />;
  }

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-center justify-between" style={{ marginTop: 0 }}>
        <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({walls.length})</div>
        <button onClick={onViewAll} className="text-xs font-bold hover:underline" style={{ color: BLUE }}>View all</button>
      </div>
      <CardCarousel
        items={results}
        itemKey={({ wall }) => wall.id}
        cardClassName="w-[260px]"
        renderItem={({ wall: w, out: r }) => {
          const on = w.id === activeId;
          return (
            <button onClick={() => onSelectWall(w.id)}
              className={`group relative flex w-full flex-col rounded-2xl border-2 bg-white p-3.5 text-left transition-all active:scale-[0.98] dark:bg-slate-800 ${
                on
                  ? "shadow-[0_1px_1px_rgba(15,23,42,0.04),0_18px_30px_-18px_rgba(0,103,185,0.45)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.2),0_18px_30px_-16px_rgba(58,168,255,0.4)]"
                  : `border-slate-200 dark:border-slate-600 ${selectableOffCx}`
              }`}
              style={on ? { borderColor: BLUE } : undefined}>
              {warnById[w.id] && <span title="Has warnings -- open this wall to see details" className="absolute right-3 top-3 z-10 h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={goldBubbleFill} />}
              <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />
              <div className="mt-3 min-w-0">
                <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{w.name}</div>
                <div className="mt-0.5 truncate text-xs font-medium" style={{ color: MUTED }}>
                  {w.orient === "vertical" ? "Vert" : "Horiz"}{r.empty ? "" : ` · ${r.area} m2`}
                </div>
              </div>
              <span className={`mt-2 inline-flex self-start ${statusChipCx(deriveWallStatus(w, r))}`}>{statusLabel(deriveWallStatus(w, r))}</span>
            </button>
          );
        }}
      />
      <div className="mt-3">
        <button onClick={addBlankWall}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3.5 py-2.5 text-sm font-bold active:scale-95 transition-all bg-white dark:bg-slate-800"
          style={{ borderColor: BLUE, color: BLUE }}>
          <Plus size={14} />Add wall
        </button>
      </div>
    </div>
  );
};
