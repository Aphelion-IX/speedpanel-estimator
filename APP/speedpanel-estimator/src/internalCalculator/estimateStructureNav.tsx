// =============================================================================
// Estimate Structure nav
// =============================================================================
// Permanent navigator listing every wall plus synthesized Corner/Shaft "kit"
// rows (see ../estimate/synthesizeKits.ts) as one selectable set -- replaces
// the old flat wall-tab strip for Internal. Selecting a wall drives activeId
// exactly as the old tab strip did; selecting a kit is local state (see
// ../estimate/navSelection.ts) rendered by the Calculator Workspace's
// KitWorkspace.
//
// Web renders as a full-width horizontal card carousel (ui/cardCarousel.tsx)
// instead of the old narrow-sidebar text list -- each wall card shows its
// actual preview diagram (ui/wallPreview.tsx, size="thumb") as a thumbnail
// image, plus the workflow status pill already used on phone (deriveWallStatus)
// and the existing warning-dot bubble (a distinct signal: compute warnings,
// not workflow status). Kit cards have no wall shape to preview, so they get
// a Link2-icon thumbnail instead. Phone keeps its own WallPillStripPhone
// (phoneShell.tsx), now also carrying a thumbnail per pill.
// =============================================================================
import { Plus, Link2, Layers, Pencil, Copy, Trash2 } from "lucide-react";
import { cx, BLUE, NAVY, MUTED, selectableOffCx, goldBubbleFill } from "../styleTokens";
import type { Wall, WallResult } from "../estimate/wall.types";
import { kitLabel, type KitEntry } from "../estimate/synthesizeKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, statusChipCx, statusLabel, type PhonePillItem, type ItemStatusKey } from "./phoneShell";
import { CardCarousel } from "../ui/cardCarousel";
import { WallPreviewSection } from "../ui/wallPreview";

// String <-> SelectedNavItem encoding for the phone pill scroller, which
// only knows about opaque string ids (see itemPillScroller.tsx's header).
const wallPillId = (id: number) => `wall-${id}`;
const kitPillId = (k: KitEntry) => `kit-${k.kind}-${k.wallAId}-${k.wallBId}`;
const decodePillId = (id: string, kits: KitEntry[]): SelectedNavItem => {
  if (id.startsWith("wall-")) return { type: "wall", wallId: Number(id.slice(5)) };
  const kit = kits.find(k => kitPillId(k) === id);
  return kit ? { type: "kit", kind: kit.kind, wallAId: kit.wallAId, wallBId: kit.wallBId } : { type: "wall", wallId: -1 };
};

// --- Card chrome shared by wall and kit cards --------------------------------
const CardShell = ({ on, warn, warnTitle, onClick, children }: {
  on: boolean; warn: boolean; warnTitle: string; onClick: () => void; children: React.ReactNode;
}) => (
  <button onClick={onClick}
    className={`group relative flex w-full flex-col rounded-2xl border-2 bg-white p-3.5 text-left transition-all active:scale-[0.98] dark:bg-slate-800 ${
      on
        ? "shadow-[0_1px_1px_rgba(15,23,42,0.04),0_18px_30px_-18px_rgba(0,103,185,0.45)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.2),0_18px_30px_-16px_rgba(58,168,255,0.4)]"
        : `border-slate-200 dark:border-slate-600 ${selectableOffCx}`
    }`}
    style={on ? { borderColor: BLUE } : undefined}>
    {warn && <span title={warnTitle} className="absolute right-3 top-3 z-10 h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={goldBubbleFill} />}
    {children}
  </button>
);

const CardBody = ({ title, subtitle, status }: { title: string; subtitle: string; status: ItemStatusKey }) => (
  <>
    <div className="mt-3 min-w-0">
      <div className="truncate text-sm font-bold" style={{ color: NAVY }}>{title}</div>
      <div className="mt-0.5 truncate text-xs font-medium" style={{ color: MUTED }}>{subtitle}</div>
    </div>
    <span className={`mt-2 inline-flex self-start ${statusChipCx(status)}`}>{statusLabel(status)}</span>
  </>
);

const KitThumbnail = () => (
  <div className="flex h-[90px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40">
    <Link2 size={22} style={{ color: BLUE }} />
  </div>
);

// --- WallCard -----------------------------------------------------------------
// The "My Walls" grid's per-wall card: unlike CardShell (a single <button>,
// used for kit cards which have no per-card actions), this is a div with its
// own click handler so Duplicate/Delete can be real nested <button>s -- a
// <button> can't contain another <button> per the HTML spec.
const WallCard = ({ wall, out, on, warn, onClick, onDuplicate, onDelete, deleteDisabled, dimUnit, toDisp, walls }: {
  wall: Wall; out: WallResult["out"]; on: boolean; warn: boolean; onClick: () => void;
  onDuplicate: () => void; onDelete: () => void; deleteDisabled: boolean;
  dimUnit: string; toDisp: (m: string) => string; walls: Wall[];
}) => (
  <div
    role="button" tabIndex={0} onClick={onClick}
    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
    className={`group relative flex w-full cursor-pointer flex-col rounded-2xl border-2 bg-white p-3.5 text-left transition-all active:scale-[0.98] dark:bg-slate-800 ${
      on
        ? "shadow-[0_1px_1px_rgba(15,23,42,0.04),0_18px_30px_-18px_rgba(0,103,185,0.45)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.2),0_18px_30px_-16px_rgba(58,168,255,0.4)]"
        : `border-slate-200 dark:border-slate-600 ${selectableOffCx}`
    }`}
    style={on ? { borderColor: BLUE } : undefined}>
    {warn && <span title="Has warnings -- open this wall to see details" className="absolute right-3 top-3 z-10 h-2.5 w-2.5 rounded-full transition-transform group-hover:scale-125" style={goldBubbleFill} />}
    <WallPreviewSection active={wall} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />
    <div className="mt-3 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-bold" style={{ color: NAVY }}>{wall.name}</span>
        <Pencil size={13} style={{ color: MUTED }} />
      </div>
      <div className="mt-0.5 truncate text-xs font-medium" style={{ color: MUTED }}>
        {wall.orient === "vertical" ? "Vertical" : "Horizontal"} · P{wall.type} · Internal
      </div>
      <span className={`mt-2 inline-flex ${statusChipCx(deriveWallStatus(wall, walls, out))}`}>
        {statusLabel(deriveWallStatus(wall, walls, out))}
      </span>
    </div>
    <div className="mt-3 flex items-center gap-3 border-t border-slate-100 dark:border-slate-700 pt-2.5">
      <button type="button" onClick={e => { e.stopPropagation(); onDuplicate(); }}
        className="flex items-center gap-1.5 text-xs font-bold" style={{ color: NAVY }}>
        <Copy size={13} />Duplicate
      </button>
      <span className="h-4 w-px bg-slate-200 dark:bg-slate-600" />
      <button type="button" disabled={deleteDisabled} onClick={e => { e.stopPropagation(); onDelete(); }}
        className="flex items-center gap-1.5 text-xs font-bold text-red-600 disabled:opacity-40 disabled:pointer-events-none dark:text-red-300">
        <Trash2 size={13} />Delete
      </button>
    </div>
  </div>
);

// --- AddWallTile ----------------------------------------------------------------
// Trailing tile in the "My Walls" carousel -- the sole add-a-wall entry point
// now that Add corner/Add shaft (rarely used -- corner/shaft walls are set up
// via the Wall system selector on an existing wall, not created as their own
// type) and the "View all" link/AllWallsPage are gone: this card grid already
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

type CardItem = ({ type: "wall" } & WallResult) | { type: "kit"; kit: KitEntry } | { type: "add" };

export const EstimateStructureNav = ({
  walls, results, kits, selected, onSelect, warnById,
  addBlankWall, duplicateWallById, deleteWallById, layoutMode, dimUnit, toDisp,
}: {
  walls: Wall[]; results: WallResult[]; kits: KitEntry[];
  selected: SelectedNavItem; onSelect: (item: SelectedNavItem) => void;
  warnById: Record<number, boolean>;
  addBlankWall: () => void;
  duplicateWallById: (id: number) => void; deleteWallById: (id: number) => void;
  layoutMode?: EffectiveLayout;
  dimUnit: string; toDisp: (m: string) => string;
}) => {
  if (layoutMode === "phone") {
    const items: PhonePillItem[] = [
      ...results.map(({ wall: w, out: r }) => ({
        id: wallPillId(w.id),
        label: w.name,
        sublabel: `${w.orient === "vertical" ? "Vert" : "Horiz"} · P${w.type}${r.empty ? "" : ` · ${r.area} m2`}`,
        active: selected.type === "wall" && selected.wallId === w.id,
        status: deriveWallStatus(w, walls, r),
        thumbnail: <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />,
        onDuplicate: () => duplicateWallById(w.id),
        onDelete: () => deleteWallById(w.id),
        deleteDisabled: false,
      })),
      ...kits.map(k => ({
        id: kitPillId(k),
        label: kitLabel(k, kits),
        sublabel: `Links ${k.wallAName} ↔ ${k.wallBName}`,
        active: selected.type === "kit" && selected.wallAId === k.wallAId && selected.wallBId === k.wallBId,
        status: "linked" as const,
        thumbnail: <KitThumbnail />,
      })),
    ];
    return <WallPillStripPhone items={items} onSelect={id => onSelect(decodePillId(id, kits))} onAddWall={addBlankWall} />;
  }

  const items: CardItem[] = [
    ...results.map(r => ({ type: "wall" as const, ...r })),
    ...kits.map(kit => ({ type: "kit" as const, kit })),
    { type: "add" as const },
  ];

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-center justify-between" style={{ marginTop: 0 }}>
        <div className={`${cx.cardHd} flex items-center gap-1.5`} style={{ marginTop: 0 }}>
          <Layers size={12} />My Walls ({walls.length + kits.length})
        </div>
        <button onClick={addBlankWall}
          className="flex items-center gap-1.5 rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/60 dark:bg-blue-900/55 px-3.5 py-2 text-xs font-bold active:scale-95 transition-all"
          style={{ color: BLUE }}>
          <Plus size={14} />Add wall
        </button>
      </div>
      <CardCarousel
        items={items}
        itemKey={(item, i) => (item.type === "wall" ? item.wall.id : item.type === "kit" ? kitPillId(item.kit) : `add-${i}`)}
        cardClassName="w-[260px]"
        renderItem={item => item.type === "wall" ? (
          <WallCard
            wall={item.wall} out={item.out}
            on={selected.type === "wall" && selected.wallId === item.wall.id}
            warn={!!warnById[item.wall.id]}
            onClick={() => onSelect({ type: "wall", wallId: item.wall.id })}
            onDuplicate={() => duplicateWallById(item.wall.id)}
            onDelete={() => deleteWallById(item.wall.id)}
            deleteDisabled={false}
            dimUnit={dimUnit} toDisp={toDisp} walls={walls}
          />
        ) : item.type === "kit" ? (
          <CardShell
            on={selected.type === "kit" && selected.wallAId === item.kit.wallAId && selected.wallBId === item.kit.wallBId}
            warn={item.kit.result.warnings.length > 0}
            warnTitle="Has warnings -- open this kit to see details"
            onClick={() => onSelect({ type: "kit", kind: item.kit.kind, wallAId: item.kit.wallAId, wallBId: item.kit.wallBId })}
          >
            <KitThumbnail />
            <CardBody title={kitLabel(item.kit, kits)} subtitle={`Links ${item.kit.wallAName} ↔ ${item.kit.wallBName}`} status="linked" />
          </CardShell>
        ) : (
          <AddWallTile onClick={addBlankWall} />
        )}
      />
    </div>
  );
};
