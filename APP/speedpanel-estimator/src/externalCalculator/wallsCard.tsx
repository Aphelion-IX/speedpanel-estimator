// =============================================================================
// Walls card (External Calculator only)
// =============================================================================
// Wall-list management UI: the WallsCard itself (system selector slot,
// generic junction link picker, name/duplicate/delete), and the read-only
// project-wide WallsSummaryTable.
//
// Forked from what used to be a single file shared with InternalCalculator
// (see internalCalculator/wallsCard.tsx for its own, independent copy).
// External never had a Corner/Shaft wall-system concept or a P51/P64/P78
// panel-type choice (always called the old shared WallsCard with
// showTypes=false and no onCornerLink/onShaftLink), so this copy simply
// doesn't carry that surface at all -- not trimmed-but-present, genuinely
// absent, since External has no use for it.
// =============================================================================
import { Copy, Frame, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, GOLD, MUTED } from "../styleTokens";
import { IconButton } from "../ui/primitives";
import { Table, type TableColumn } from "../ui/table";
import type { Wall, WallResult } from "../estimate/wall.types";

// --- WallLinkSelector -----------------------------------------------------------
// Shared "pick a partner wall from a list" shell for JunctionLinkSelector below.
interface WallLinkSelectorProps {
  heading: string;
  walls: Wall[];
  active: Wall;
  filter: (w: Wall) => boolean;
  partnerId: number | null | undefined;
  onLink: (targetId: number | null) => void;
  label?: (w: Wall, on: boolean) => React.ReactNode;
  note: (partner: Wall | undefined) => React.ReactNode;
}
const WallLinkSelector = ({ heading, walls, active, filter, partnerId, onLink, label, note }: WallLinkSelectorProps) => {
  const linkable = walls.filter(w => w.id !== active.id && filter(w));
  const partner = walls.find(w => w.id === partnerId);
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className={cx.cardHd}>{heading}</div>
      <div className="space-y-1.5">
        <button onClick={() => onLink(null)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (!partner ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
          style={!partner ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
          Not linked
        </button>
        {linkable.map(w => {
          const on = partner?.id === w.id;
          return (
            <button key={w.id} onClick={() => onLink(w.id)}
              className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
              style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
              {label ? label(w, on) : w.name}
            </button>
          );
        })}
      </div>
      {note(partner)}
    </div>
  );
};

// --- JunctionLinkSelector -----------------------------------------------------
// Generic wall-to-wall adjoining link, available on ANY wall regardless of
// orientation -- it only produces an extra C/J track allowance when the two
// linked walls have different orientations (see
// src/estimate/calculateConnectionMaterials.ts); linking two walls of the
// same orientation is harmless (no material is added) but isn't the intended
// use, so the note below is explicit about that.
export const JunctionLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => (
  <WallLinkSelector
    heading="Adjoining wall (junction)"
    walls={walls} active={active}
    filter={w => w.junctionPartnerId == null || w.junctionPartnerId === active.id}
    partnerId={active.junctionPartnerId}
    onLink={onLink}
    label={(w, on) => <>{w.name} <span className="font-normal" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>({w.orient === "vertical" ? "Vert" : "Horiz"})</span></>}
    note={partner => (
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {partner
          ? partner.orient !== active.orient
            ? <>Linked to <span className="font-semibold">{partner.name}</span>. Combined estimate includes an extra C/J track allowance where these two walls meet.</>
            : <>Linked to <span className="font-semibold">{partner.name}</span>. Same orientation -- no extra junction material is added.</>
          : "Mark another wall in this project as physically adjoining this one, so the combined estimate can allow for the extra C/J track needed where a vertical and horizontal wall meet."}
      </p>
    )}
  />
);

// --- WallNameAndActions -----------------------------------------------------------
export const WallNameAndActions = ({ walls, active, update, duplicateWall, deleteWall }: {
  walls: Wall[]; active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void;
}) => (
  <div className="flex items-center gap-2 mt-2">
    <input value={active.name} onChange={e => update({ name: e.target.value })} maxLength={32} className={cx.wallName} style={{ color: NAVY }} />
    <IconButton onClick={duplicateWall} title="Duplicate"><Copy size={15} /></IconButton>
    <IconButton onClick={deleteWall} disabled={walls.length === 1} variant="danger" title="Delete"><Trash2 size={15} /></IconButton>
  </div>
);

// --- WallsCard ----------------------------------------------------------------
export interface WallsCardProps {
  walls: Wall[];
  active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void;
  systemSelector?: React.ReactNode; // optional system buttons rendered at the top
  onJunctionLink?: (targetId: number | null) => void; // Generic adjoining-wall linking
}
export const WallsCard = ({ walls, active, update, duplicateWall, deleteWall, systemSelector, onJunctionLink }: WallsCardProps) => (
  <div className={cx.section}>
    {systemSelector && (
      <div>
        {systemSelector}
      </div>
    )}
    {/* Generic adjoining-wall junction link -- available on every wall in
        the project (see JunctionLinkSelector). */}
    {onJunctionLink && walls.length > 1 && (
      <JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} />
    )}
    {/* Name/duplicate/delete toolbar for whichever wall is active. The
        Estimate Structure nav is the wall picker + add-wall entry point, so
        the old tab-strip (once rendered here too) is gone. */}
    <div className={systemSelector ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
      <WallNameAndActions walls={walls} active={active} update={update} duplicateWall={duplicateWall} deleteWall={deleteWall} />
    </div>
  </div>
);

// --- WallsSummaryTable ----------------------------------------------------------
// Web/tablet-only "all walls at a glance" table. No new state -- driven entirely
// by data already computed by the wall store / useWallResults (results/activeId/warnById);
// clicking a row calls the same setActiveId used by WallsCard's tab strip.
export const WallsSummaryTable = ({ results, activeId, setActiveId, warnById, toDisp, dimUnit }: {
  results: WallResult[]; activeId: number; setActiveId: (id: number) => void;
  warnById: Record<number, boolean>; toDisp: (m: string) => string; dimUnit: string;
}) => {
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  const columns: TableColumn<WallResult>[] = [
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
  ];
  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}><Frame size={14} /></span>Walls ({results.length})
      </div>
      <div className="mt-2">
        <Table
          columns={columns}
          rows={results}
          rowKey={({ wall }) => wall.id}
          onRowClick={({ wall }) => setActiveId(wall.id)}
          rowClassName={({ wall }) => (wall.id === activeId ? "bg-blue-50/60 dark:bg-blue-950/40" : undefined)}
        />
      </div>
    </div>
  );
};
