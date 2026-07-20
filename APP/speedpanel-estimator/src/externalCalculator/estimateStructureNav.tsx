// =============================================================================
// Estimate Structure nav (External)
// =============================================================================
// Walls-only counterpart to internalCalculator/estimateStructureNav.tsx --
// External has no wallSystem/Corner/Shaft concept, so there's no kit rows or
// "+ Add corner"/"+ Add shaft" actions here, just walls + "+ Add wall".
//
// Web renders as the mockup's own vertical sticky sidebar (ui/
// estimatorTheme.css's `.structure`/`.wall-list`/`.wall-item`, ported
// directly from speedpanel-estimator-web-v5.html) -- a striped `.mini-wall`
// swatch per row (the real measured preview lives in the Wall geometry card
// instead), the wall's name/orientation, and its status pill. Duplicate/
// Delete live in the Wall setup config card instead (see wallsCard.tsx's
// WallNameAndActions), matching the mockup -- the nav row itself has no
// per-row actions. Phone keeps its own WallPillStripPhone (phoneShell.tsx).
// =============================================================================
import { Plus, Layers } from "lucide-react";
import type { Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallPillStripPhone, deriveWallStatus, statusLabel, type PhonePillItem, type ItemStatusKey } from "./phoneShell";
import { WallPreviewSection } from "../ui/wallPreview";

// Mockup pill colour per status (speedpanel-estimator-web-states-v5.html's
// wall-status gallery: notStarted=neutral, incomplete/error=red, ready=
// green, warning=orange).
const STATUS_PILL_CLASS: Record<ItemStatusKey, string> = {
  notStarted: "pill",
  incomplete: "pill red",
  ready: "pill green",
  warning: "pill orange",
  error: "pill red",
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
        <span>{wall.orient === "vertical" ? "Vertical" : "Horizontal"}</span>
      </div>
      <span className={STATUS_PILL_CLASS[status]}>{statusLabel(status)}</span>
    </button>
  );
};

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
  // warnById is unused on web now (nav rows have no per-row actions or full
  // preview, see this file's header comment) but stays in the props
  // contract -- phone's own branch below still needs warnById-derived data
  // indirectly via deriveWallStatus's out.warnings.
  void warnById;

  if (layoutMode === "phone") {
    const items: PhonePillItem[] = results.map(({ wall: w, out: r }) => ({
      id: String(w.id),
      label: w.name,
      sublabel: `${w.orient === "vertical" ? "Vert" : "Horiz"}${r.empty ? "" : ` · ${r.area} m2`}`,
      active: w.id === activeId,
      status: deriveWallStatus(w, walls, r),
      thumbnail: <WallPreviewSection active={w} walls={walls} out={r} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />,
      onDuplicate: () => duplicateWallById(w.id),
      onDelete: () => deleteWallById(w.id),
      deleteDisabled: false,
    }));
    return <WallPillStripPhone items={items} onSelect={id => onSelectWall(Number(id))} onAddWall={addBlankWall} />;
  }

  return (
    <aside className="structure card">
      <div className="structure-head">
        <div><span className="eyebrow">Estimate structure</span><h2><Layers size={14} className="inline mr-1.5 align-[-2px]" />Walls</h2></div>
        <button className="btn icon-only primary" onClick={addBlankWall} aria-label="Add wall"><Plus size={16} /></button>
      </div>
      <p className="structure-note">Select a wall to edit it.</p>
      <div className="wall-list">
        {results.map(({ wall, out }) => (
          <WallRow key={wall.id} wall={wall} out={out} walls={walls}
            on={wall.id === activeId}
            onClick={() => onSelectWall(wall.id)} />
        ))}
      </div>
      <div className="add-wall-buttons">
        <button className="btn" onClick={addBlankWall}><Plus size={14} />Add wall</button>
      </div>
    </aside>
  );
};
