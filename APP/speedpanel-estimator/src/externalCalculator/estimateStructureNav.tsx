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
// name/rename affordance, Duplicate/Delete, and the existing warning-dot
// bubble. Phone keeps its own WallPillStripPhone (phoneShell.tsx, still
// showing the workflow status pill via deriveWallStatus), now also carrying
// a thumbnail per pill.
// =============================================================================
import { Plus, Layers, Pencil, Copy, Trash2 } from "lucide-react";
import { cx, BLUE, NAVY, MUTED, selectableOffCx, goldBubbleFill } from "../styleTokens";
import type { Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, type PhonePillItem } from "./phoneShell";
import { CardCarousel } from "../ui/cardCarousel";
import { WallPreviewSection } from "../ui/wallPreview";

// --- AddWallTile ----------------------------------------------------------------
// Trailing tile in the "My Walls" carousel -- the sole add-a-wall entry point
// now that the "View all" link/AllWallsPage is gone: this card grid already
// shows every wall with Duplicate/Delete inline, which is all AllWallsPage did.
const AddWallTile = ({ onClick }: { onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className={`flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed bg-white text-center active:scale-[0.98] transition-all dark:bg-slate-800 ${selectableOffCx}`}
    style={{ borderColor: BLUE }}>
    <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 dark:bg-blue-900/55">
      <Plus size={18} style={{ color: BLUE }} />
    </span>
    <span className="text-sm font-bold" style={{ color: BLUE }}>Add wall</span>
  </button>
);

type CardItem = ({ type: "wall" } & WallResult) | { type: "add" };

export const EstimateStructureNav = ({
  walls, results, activeId, onSelectWall, warnById, addBlankWall,
  duplicateWallById, deleteWallById, layoutMode, dimUnit, toDisp,
}: {
  walls: Wall[]; results: WallResult[]; activeId: number; onSelectWall: (id: number) => void;
  warnById: Record<number, boolean>; addBlankWall: () => void;
  duplicateWallById: (id: number) => void; deleteWallById: (id: number) => void;
  layoutMode?: EffectiveLayout;
  dimUnit: string; toDisp: (m: string) => string;
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

  const items: CardItem[] = [
    ...results.map(r => ({ type: "wall" as const, ...r })),
    { type: "add" as const },
  ];

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-center justify-between" style={{ marginTop: 0 }}>
        <div className={`${cx.cardHd} flex items-center gap-1.5`} style={{ marginTop: 0 }}>
          <Layers size={12} />My Walls ({walls.length})
        </div>
        <button onClick={addBlankWall}
          className="flex items-center gap-1.5 rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-3.5 py-2 text-xs font-bold active:scale-95 transition-all"
          style={{ color: BLUE }}>
          <Plus size={14} />Add wall
        </button>
      </div>
      <CardCarousel
        items={items}
        itemKey={(item, i) => (item.type === "wall" ? item.wall.id : `add-${i}`)}
        cardClassName="w-[260px]"
        renderItem={item => {
          if (item.type === "add") return <AddWallTile onClick={addBlankWall} />;
          const { wall: w, out: r } = item;
          const on = w.id === activeId;
          return (
            <div
              role="button" tabIndex={0} onClick={() => onSelectWall(w.id)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectWall(w.id); } }}
              className={`group relative flex w-full cursor-pointer flex-col rounded-2xl border-2 bg-white p-3.5 text-left transition-all active:scale-[0.98] dark:bg-slate-800 ${
                on
                  ? "shadow-[0_1px_1px_rgba(15,23,42,0.04),0_18px_30px_-18px_rgba(0,103,185,0.45)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.2),0_18px_30px_-16px_rgba(58,168,255,0.4)]"
                  : `border-slate-200 dark:border-slate-600 ${selectableOffCx}`
              }`}
              style={on ? { borderColor: BLUE } : undefined}>
              {warnById[w.id] && <span title="Has warnings -- open this wall to see details" className="absolute right-3 top-3 z-10 h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={goldBubbleFill} />}
              <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />
              <div className="mt-3 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold" style={{ color: NAVY }}>{w.name}</span>
                  <Pencil size={13} style={{ color: MUTED }} />
                </div>
                <div className="mt-0.5 truncate text-xs font-medium" style={{ color: MUTED }}>
                  {w.orient === "vertical" ? "Vertical" : "Horizontal"} · P78 · External
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-2.5">
                <button type="button" onClick={e => { e.stopPropagation(); duplicateWallById(w.id); }}
                  className="flex items-center gap-1.5 text-xs font-bold" style={{ color: NAVY }}>
                  <Copy size={13} />Duplicate
                </button>
                <span className="h-4 w-px bg-slate-200 dark:bg-slate-600" />
                <button type="button" disabled={walls.length === 1} onClick={e => { e.stopPropagation(); deleteWallById(w.id); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-red-600 disabled:opacity-40 disabled:pointer-events-none dark:text-red-300">
                  <Trash2 size={13} />Delete
                </button>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};
