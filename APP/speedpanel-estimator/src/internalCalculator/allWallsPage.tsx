// =============================================================================
// All Walls page (Internal Calculator only)
// =============================================================================
// Full-page "every wall at a glance" table, reached via the "View all" link
// on the Estimate Structure card carousel (estimateStructureNav.tsx). Swaps
// in for InternalCalculator's entire rendered output while open (see its
// early-return wiring in InternalCalculator.tsx) rather than a modal/drawer
// -- same "separate page, app shell stays, Back returns you exactly where
// you were" convention pages/projects/ProjectDetailPage.tsx already uses for
// its own onBack link.
//
// Replaces the old inline WallsSummaryTable (wallsCard.tsx) that used to sit
// in the Overview tab -- same columns, plus a preview thumbnail and per-row
// Duplicate/Delete so a project's whole wall list can be managed from one
// screen instead of one wall at a time. No kit rows -- kits (synthesized
// Corner/Shaft pairs) aren't independent entities, nothing to duplicate or
// delete, same scope the old table already had.
// =============================================================================
import { ChevronLeft, Copy, Frame, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE } from "../styleTokens";
import { IconButton } from "../ui/primitives";
import { Table, type TableColumn } from "../ui/table";
import { WallPreviewSection } from "../ui/wallPreview";
import type { Wall, WallResult } from "../estimate/wall.types";

export const AllWallsPage = ({ walls, results, warnById, toDisp, dimUnit, onSelectWall, duplicateWallById, deleteWallById, onBack }: {
  walls: Wall[]; results: WallResult[];
  warnById: Record<number, boolean>; toDisp: (m: string) => string; dimUnit: string;
  onSelectWall: (id: number) => void;
  duplicateWallById: (id: number) => void; deleteWallById: (id: number) => void;
  onBack: () => void;
}) => {
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  const columns: TableColumn<WallResult>[] = [
    {
      key: "preview", header: "", className: "w-[84px]",
      cell: ({ wall, out }) => (
        <div className="w-[72px] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900/40">
          <WallPreviewSection active={wall} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} size="thumb" />
        </div>
      ),
    },
    {
      key: "wall", header: "Wall",
      cell: ({ wall }) => (
        <span className="font-semibold" style={{ color: NAVY }}>
          {/* Red, not gold -- same colour rule WallsSummaryTable used
              (Internal's own copy, no longer shared with External). */}
          {warnById[wall.id] && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle bg-red-600 dark:bg-red-500" />}
          {wall.name}
        </span>
      ),
    },
    { key: "orientation", header: "Orientation", cell: ({ wall }) => (wall.orient === "vertical" ? "Vertical" : "Horizontal") },
    { key: "type", header: "Type", cell: ({ wall }) => `P${wall.type}` },
    { key: "width", header: "Width", cell: ({ wall }) => dim(wall.width) },
    { key: "height", header: "Height", cell: ({ wall }) => dim(wall.height) },
    { key: "area", header: "Area", cell: ({ out }) => (out.empty ? "--" : `${out.area} m2`) },
    { key: "panels", header: "Panels", cell: ({ out }) => (out.empty ? "--" : (out.chosen?.panels ?? out.result?.panels ?? "--")) },
    {
      key: "actions", header: "", align: "right",
      cell: ({ wall }) => (
        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
          <IconButton onClick={() => duplicateWallById(wall.id)} title="Duplicate"><Copy size={15} /></IconButton>
          <IconButton onClick={() => deleteWallById(wall.id)} disabled={results.length === 1} variant="danger" title="Delete"><Trash2 size={15} /></IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-3">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
        <ChevronLeft className="h-4 w-4" />Back
      </button>
      <div className={`mt-3 ${cx.card}`}>
        <div className={cx.cardTitle} style={{ color: NAVY }}>
          <span style={{ color: BLUE }}><Frame size={14} /></span>All walls ({results.length})
        </div>
        <div className="mt-2">
          <Table
            columns={columns}
            rows={results}
            rowKey={({ wall }) => wall.id}
            onRowClick={({ wall }) => { onSelectWall(wall.id); onBack(); }}
          />
        </div>
      </div>
    </div>
  );
};
