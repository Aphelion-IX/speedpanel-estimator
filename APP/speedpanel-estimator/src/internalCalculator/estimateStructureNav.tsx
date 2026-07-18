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
import { Plus, Link2 } from "lucide-react";
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

type CardItem = ({ type: "wall" } & WallResult) | { type: "kit"; kit: KitEntry };

export const EstimateStructureNav = ({
  walls, results, kits, selected, onSelect, warnById,
  addBlankWall, addCornerWall, addShaftWall, layoutMode, dimUnit, toDisp, onViewAll,
}: {
  walls: Wall[]; results: WallResult[]; kits: KitEntry[];
  selected: SelectedNavItem; onSelect: (item: SelectedNavItem) => void;
  warnById: Record<number, boolean>;
  addBlankWall: () => void; addCornerWall: () => void; addShaftWall: () => void;
  layoutMode?: EffectiveLayout;
  dimUnit: string; toDisp: (m: string) => string;
  // Opens the All Walls page (allWallsPage.tsx) -- web only, see the
  // "View all" link in the header row below.
  onViewAll: () => void;
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
        thumbnail: <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />,
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
    return <WallPillStripPhone items={items} onSelect={id => onSelect(decodePillId(id, kits))} />;
  }

  const items: CardItem[] = [
    ...results.map(r => ({ type: "wall" as const, ...r })),
    ...kits.map(kit => ({ type: "kit" as const, kit })),
  ];

  return (
    <div className={`mt-3 ${cx.section}`}>
      <div className="flex items-center justify-between" style={{ marginTop: 0 }}>
        <div className={cx.cardHd} style={{ marginTop: 0 }}>Estimate structure ({walls.length + kits.length})</div>
        <button onClick={onViewAll} className="text-xs font-bold hover:underline" style={{ color: BLUE }}>View all</button>
      </div>
      <CardCarousel
        items={items}
        itemKey={item => (item.type === "wall" ? item.wall.id : kitPillId(item.kit))}
        cardClassName="w-[260px]"
        renderItem={item => item.type === "wall" ? (
          <CardShell
            on={selected.type === "wall" && selected.wallId === item.wall.id}
            warn={!!warnById[item.wall.id]}
            warnTitle="Has warnings -- open this wall to see details"
            onClick={() => onSelect({ type: "wall", wallId: item.wall.id })}
          >
            <WallPreviewSection active={item.wall} walls={walls} out={item.out} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />
            <CardBody
              title={item.wall.name}
              subtitle={`${item.wall.orient === "vertical" ? "Vert" : "Horiz"} · P${item.wall.type}${item.out.empty ? "" : ` · ${item.out.area} m2`}`}
              status={deriveWallStatus(item.wall, item.out)}
            />
          </CardShell>
        ) : (
          <CardShell
            on={selected.type === "kit" && selected.wallAId === item.kit.wallAId && selected.wallBId === item.kit.wallBId}
            warn={item.kit.result.warnings.length > 0}
            warnTitle="Has warnings -- open this kit to see details"
            onClick={() => onSelect({ type: "kit", kind: item.kit.kind, wallAId: item.kit.wallAId, wallBId: item.kit.wallBId })}
          >
            <KitThumbnail />
            <CardBody title={kitLabel(item.kit, kits)} subtitle={`Links ${item.kit.wallAName} ↔ ${item.kit.wallBName}`} status="linked" />
          </CardShell>
        )}
      />
      <div className="mt-3 grid grid-cols-3 gap-1.5">
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
