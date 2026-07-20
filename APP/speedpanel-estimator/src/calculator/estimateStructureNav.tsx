// =============================================================================
// Estimate Structure nav
// =============================================================================
// Permanent navigator listing every wall plus synthesized Corner/Shaft "kit"
// rows (see ../estimate/synthesizeKits.ts) as one selectable set. Selecting
// a wall drives activeId exactly as the old tab strip did; selecting a kit
// is local state (see ../estimate/navSelection.ts) rendered by the
// Calculator Workspace's KitWorkspace.
//
// Web renders as the mockup's own vertical sticky sidebar (ui/
// estimatorTheme.css's `.structure`/`.wall-list`/`.wall-item`/`.kit-item`,
// ported directly from speedpanel-estimator-web-v5.html) -- a striped
// `.mini-wall` swatch per row (not the full SVG WallPreviewSection
// thumbnail; the mockup's own nav rows use a plain orientation swatch, the
// real measured preview lives in the Wall geometry card instead), the
// wall's name/orientation/panel type, and its status pill. Duplicate/
// Delete live in the Wall setup config card instead (see wallsCard.tsx's
// WallNameAndActions), matching the mockup -- the nav row itself has no
// per-row actions. Phone keeps its own WallPillStripPhone (phoneShell.tsx).
// =============================================================================
import { Plus, Link2, Layers } from "lucide-react";
import type { Wall, WallResult } from "../estimate/wall.types";
import { kitLabel, type KitEntry } from "../estimate/synthesizeKits";
import type { SelectedNavItem } from "../estimate/navSelection";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, statusLabel, type PhonePillItem, type ItemStatusKey } from "./phoneShell";
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

// Mockup pill colour per status (speedpanel-estimator-web-states-v5.html's
// wall-status gallery: notStarted=neutral, incomplete/error=red, ready=
// green, warning=orange; the active-estimator mockup's own kit row uses
// blue for "Linked", not cyan).
const STATUS_PILL_CLASS: Record<ItemStatusKey, string> = {
  notStarted: "pill",
  incomplete: "pill red",
  ready: "pill green",
  warning: "pill orange",
  error: "pill red",
  linked: "pill blue",
};

const WallRow = ({ wall, out, on, onClick, walls }: {
  wall: Wall; out: WallResult["out"]; on: boolean; onClick: () => void; walls: Wall[];
}) => {
  const status = deriveWallStatus(wall, walls, out);
  return (
    <button className={`wall-item${on ? " active" : ""}`} onClick={onClick}>
      <div className={`mini-wall${wall.orient === "horizontal" ? " horizontal" : ""}`} />
      <div className="wall-meta">
        <strong>{wall.name}</strong>
        <span>{wall.orient === "vertical" ? "Vertical" : "Horizontal"} · P{wall.type}</span>
      </div>
      <span className={STATUS_PILL_CLASS[status]}>{statusLabel(status)}</span>
    </button>
  );
};

const KitRow = ({ kit, kits, on, onClick }: { kit: KitEntry; kits: KitEntry[]; on: boolean; onClick: () => void }) => (
  <button className={`kit-item${on ? " active" : ""}`} onClick={onClick}>
    <span className="kit-link"><Link2 size={22} /></span>
    <div className="wall-meta">
      <strong>{kitLabel(kit, kits)}</strong>
      <span>{kit.wallAName} + {kit.wallBName}</span>
    </div>
    <span className="pill blue">Linked</span>
  </button>
);

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
  // warnById/duplicateWallById/deleteWallById/WallPreviewSection are unused
  // on web now (nav rows have no per-row actions or full preview, see this
  // file's header comment) but stay in the props contract -- phone's own
  // branch below still needs warnById-derived data indirectly via
  // deriveWallStatus's out.warnings, and duplicateWallById/deleteWallById
  // are still wired for the phone pill strip.
  void warnById; void WallPreviewSection;

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
        thumbnail: <span className="kit-link"><Link2 size={22} /></span>,
      })),
    ];
    return <WallPillStripPhone items={items} onSelect={id => onSelect(decodePillId(id, kits))} onAddWall={addBlankWall} />;
  }

  return (
    <aside className="structure card">
      <div className="structure-head">
        <div><span className="eyebrow">Estimate structure</span><h2><Layers size={14} className="inline mr-1.5 align-[-2px]" />Walls &amp; connections</h2></div>
        <button className="btn icon-only primary" onClick={addBlankWall} aria-label="Add wall"><Plus size={16} /></button>
      </div>
      <p className="structure-note">Select a wall to edit it. Corner and shaft connections appear as linked kits.</p>
      <div className="wall-list">
        {results.map(({ wall, out }) => (
          <WallRow key={wall.id} wall={wall} out={out} walls={walls}
            on={selected.type === "wall" && selected.wallId === wall.id}
            onClick={() => onSelect({ type: "wall", wallId: wall.id })} />
        ))}
        {kits.map(kit => (
          <KitRow key={kitPillId(kit)} kit={kit} kits={kits}
            on={selected.type === "kit" && selected.wallAId === kit.wallAId && selected.wallBId === kit.wallBId}
            onClick={() => onSelect({ type: "kit", kind: kit.kind, wallAId: kit.wallAId, wallBId: kit.wallBId })} />
        ))}
      </div>
      <div className="add-wall-buttons">
        <button className="btn" onClick={addBlankWall}><Plus size={14} />Add wall</button>
      </div>
    </aside>
  );
};
