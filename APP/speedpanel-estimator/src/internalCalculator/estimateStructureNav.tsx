// =============================================================================
// Estimate Structure nav
// =============================================================================
// Permanent navigator listing every wall plus synthesized Corner/Shaft "kit"
// rows (see ../estimate/synthesizeKits.ts) as one selectable list -- replaces
// the old flat wall-tab strip for Internal. Selecting a wall drives activeId
// exactly as the old tab strip did; selecting a kit is local state (see
// ../estimate/navSelection.ts) rendered by the Calculator Workspace's
// KitWorkspace.
// =============================================================================
import { Plus } from "lucide-react";
import { cx, BLUE, NAVY, MUTED, selectedFill, selectableOffCx, goldBubbleFill } from "../styleTokens";
import type { Wall, WallResult } from "../estimate/wall.types";
import { kitLabel, type KitEntry } from "../estimate/synthesizeKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, type PhonePillItem } from "./phoneShell";

// String <-> SelectedNavItem encoding for the phone pill scroller, which
// only knows about opaque string ids (see itemPillScroller.tsx's header).
const wallPillId = (id: number) => `wall-${id}`;
const kitPillId = (k: KitEntry) => `kit-${k.kind}-${k.wallAId}-${k.wallBId}`;
const decodePillId = (id: string, kits: KitEntry[]): SelectedNavItem => {
  if (id.startsWith("wall-")) return { type: "wall", wallId: Number(id.slice(5)) };
  const kit = kits.find(k => kitPillId(k) === id);
  return kit ? { type: "kit", kind: kit.kind, wallAId: kit.wallAId, wallBId: kit.wallBId } : { type: "wall", wallId: -1 };
};

const NavRow = ({ on, warn, title, subtitle, onClick }: {
  on: boolean; warn: boolean; title: string; subtitle: string; onClick: () => void;
}) => (
  <button onClick={onClick}
    className={"relative w-full rounded-xl border-2 px-3.5 py-3 text-left active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
    style={on ? selectedFill : undefined}>
    {warn && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={goldBubbleFill} />}
    <div className="text-sm font-bold" style={{ color: on ? "#fff" : NAVY }}>{title}</div>
    <div className="mt-1 text-xs font-medium" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>{subtitle}</div>
  </button>
);

export const EstimateStructureNav = ({
  walls, results, kits, selected, onSelect, warnById,
  addBlankWall, addCornerWall, addShaftWall, layoutMode,
}: {
  walls: Wall[]; results: WallResult[]; kits: KitEntry[];
  selected: SelectedNavItem; onSelect: (item: SelectedNavItem) => void;
  warnById: Record<number, boolean>;
  addBlankWall: () => void; addCornerWall: () => void; addShaftWall: () => void;
  layoutMode?: EffectiveLayout;
}) => {
  if (layoutMode === "phone") {
    // Add-wall/corner/shaft actions live on ProjectCardPhone (rendered above
    // this nav in InternalCalculator.tsx) on phone, not as trailing pills here.
    const items: PhonePillItem[] = [
      ...results.map(({ wall: w, out: r }) => ({
        id: wallPillId(w.id),
        label: w.name,
        sublabel: `${w.orient === "vertical" ? "Vert" : "Horiz"} · P${w.type}${r.empty ? "" : ` · ${r.area} m2`}`,
        active: selected.type === "wall" && selected.wallId === w.id,
        status: deriveWallStatus(w, r),
      })),
      ...kits.map(k => ({
        id: kitPillId(k),
        label: kitLabel(k, kits),
        sublabel: `Links ${k.wallAName} ↔ ${k.wallBName}`,
        active: selected.type === "kit" && selected.wallAId === k.wallAId && selected.wallBId === k.wallBId,
        status: "linked" as const,
      })),
    ];
    return <WallPillStripPhone items={items} onSelect={id => onSelect(decodePillId(id, kits))} />;
  }

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({walls.length + kits.length})</div>
      <div className="space-y-1.5">
        {results.map(({ wall: w, out: r }) => (
          <NavRow
            key={w.id}
            on={selected.type === "wall" && selected.wallId === w.id}
            warn={!!warnById[w.id]}
            title={w.name}
            subtitle={`${w.orient === "vertical" ? "Vert" : "Horiz"} · P${w.type}${r.empty ? "" : ` · ${r.area} m2`}`}
            onClick={() => onSelect({ type: "wall", wallId: w.id })}
          />
        ))}
        {kits.map(k => (
          <NavRow
            key={k.id}
            on={selected.type === "kit" && selected.wallAId === k.wallAId && selected.wallBId === k.wallBId}
            warn={k.result.warnings.length > 0}
            title={kitLabel(k, kits)}
            subtitle={`Links ${k.wallAName} ↔ ${k.wallBName}`}
            onClick={() => onSelect({ type: "kit", kind: k.kind, wallAId: k.wallAId, wallBId: k.wallBId })}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        <AddButton label="Add wall" onClick={addBlankWall} />
        <AddButton label="Add corner" onClick={addCornerWall} />
        <AddButton label="Add shaft" onClick={addShaftWall} />
      </div>
    </div>
  );
};

const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick}
    className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3.5 py-2.5 text-sm font-bold active:scale-95 transition-all bg-white dark:bg-slate-800"
    style={{ borderColor: BLUE, color: BLUE }}>
    <Plus size={14} />{label}
  </button>
);
