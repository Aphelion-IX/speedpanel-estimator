// =============================================================================
// Estimate Structure nav (External)
// =============================================================================
// Walls-only counterpart to internalCalculator/estimateStructureNav.tsx --
// External has no wallSystem/Corner/Shaft concept, so there's no kit rows or
// "+ Add corner"/"+ Add shaft" actions here, just walls + "+ Add wall".
// =============================================================================
import { Copy, Plus, Trash2 } from "lucide-react";
import { cx, BLUE, GOLD, NAVY, MUTED } from "../styleTokens";
import { IconButton } from "../ui/primitives";
import type { Wall, WallResult } from "../estimate/wall.types";

export const EstimateStructureNav = ({ walls, results, activeId, onSelectWall, warnById, addBlankWall, duplicateWall, deleteWall }: {
  walls: Wall[]; results: WallResult[]; activeId: number; onSelectWall: (id: number) => void;
  warnById: Record<number, boolean>; addBlankWall: () => void;
  duplicateWall: (id: number) => void; deleteWall: (id: number) => void;
}) => (
  <div className={`mt-3 ${cx.section}`}>
    <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({walls.length})</div>
    <div className="space-y-1.5">
      {results.map(({ wall: w, out: r }) => {
        const on = w.id === activeId;
        return (
          <div key={w.id} className={"relative flex items-center gap-2 rounded-xl border-2 px-3.5 py-3 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={on ? { borderColor: BLUE, background: BLUE } : undefined}>
            {warnById[w.id] && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />}
            <button onClick={() => onSelectWall(w.id)} className="min-w-0 flex-1 text-left active:scale-95 transition-all">
              <div className="text-sm font-bold" style={{ color: on ? "#fff" : NAVY }}>{w.name}</div>
              <div className="mt-1 text-xs font-medium" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>
                {w.orient === "vertical" ? "Vert" : "Horiz"}{r.empty ? "" : ` · ${r.area} m2`}
              </div>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <IconButton size="sm" onClick={() => duplicateWall(w.id)} title="Duplicate"><Copy size={13} /></IconButton>
              <IconButton size="sm" variant="danger" onClick={() => deleteWall(w.id)} disabled={walls.length === 1} title="Delete"><Trash2 size={13} /></IconButton>
            </div>
          </div>
        );
      })}
    </div>
    <div className="mt-2">
      <button onClick={addBlankWall}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3.5 py-2.5 text-sm font-bold active:scale-95 transition-all bg-white dark:bg-slate-800"
        style={{ borderColor: BLUE, color: BLUE }}>
        <Plus size={14} />Add wall
      </button>
    </div>
  </div>
);
