// =============================================================================
// All Walls page (External Calculator only)
// =============================================================================
// Mirrors internalCalculator/allWallsPage.tsx -- see its header comment.
// Deliberately its own copy, not imported from internalCalculator/, same
// fork-not-share reasoning as the rest of the wallsCard/estimateStructureNav
// split between the two calculators.
// =============================================================================
import { ChevronLeft, Copy, Frame, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, GOLD } from "../styleTokens";
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
          {warnById[wall.id] && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: GOLD }} />}
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
