// =============================================================================
// Walls card
// =============================================================================
// Wall-list management UI shared by both calculators: horizontal-only wall
// system selector (Standard/Corner/Shaft) plus its Corner/Shaft/generic
// junction link pickers, the WallsCard itself (system buttons, panel type,
// wall tabs, name/duplicate/delete), and the read-only project-wide
// WallsSummaryTable.
// =============================================================================
import { Copy, Frame, Plus, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, GOLD, MUTED } from "../styleTokens";
import { TYPES } from "../data";
import { IconButton } from "./primitives";
import { Table, type TableColumn } from "./table";
import type { Wall, WallResult } from "../estimate/wall.types";
import type { WallSystemId } from "../App";

// --- WallSystemSelector --------------------------------------------------------
// Horizontal-only wall system variant (Standard / Corner / Shaft), each with its
// own calculation logic: Standard (estimate_single_wall.md -- fixed C-track,
// all edges restrained), Corner (estimate_free_corner_wall.md -- 3-edge runs +
// linked corner post kit), Shaft (estimate_shaft_wall.md -- floor-height-driven
// vertical track + linked back-to-back junction kit). See computeWall's
// normalization block and each system's dedicated step-function branches.
export const WALL_SYSTEMS: [WallSystemId, string][] = [
  ["standard", "Standard wall"],
  ["corner",   "Corner wall"],
  ["shaft",    "Shaft wall"],
];

export const WallSystemSelector = ({ value, onChange }: { value: WallSystemId; onChange: (id: WallSystemId) => void }) => (
  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
    <div className={cx.cardHd}>Wall system</div>
    <div className="grid grid-cols-3 items-end gap-1.5">
      {WALL_SYSTEMS.map(([id, label]) => {
        const on = value === id;
        return (
          <button key={id} onClick={() => onChange(id)}
            className={"w-full rounded-xl border-2 py-3.5 px-2 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
            {label.replace(" wall", "")}
          </button>
        );
      })}
    </div>
  </div>
);

// --- WallLinkSelector -----------------------------------------------------------
// Shared "pick a partner wall from a list" shell used by CornerLinkSelector,
// ShaftLinkSelector, and JunctionLinkSelector below -- they differ only in
// which partner field they read/write, their linkable-wall filter, and the
// footnote/extra content shown once linked.
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

// --- CornerLinkSelector ---------------------------------------------------------
// Corner wall (see estimate_free_corner_wall.md): each run is entered as its own
// wall, then linked to its partner run to form a pair sharing one free corner.
// linkable excludes the active wall itself and any wall already linked to a
// third wall (a wall can only be in one pair at a time).
export const CornerLinkSelector = ({ active, walls, onLink, onSideChange }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
  onSideChange: (side: "left" | "right") => void;
}) => (
  <WallLinkSelector
    heading="Corner partner run"
    walls={walls} active={active}
    filter={w => w.orient === "horizontal" && w.wallSystem === "corner" && (w.cornerPartnerId == null || w.cornerPartnerId === active.id)}
    partnerId={active.cornerPartnerId}
    onLink={onLink}
    note={partner => !partner ? (
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        Link this run to another Corner wall run to calculate the shared corner post, screws, sealant, and protection strip.
      </p>
    ) : (
      <>
        <div className="mt-2.5">
          <div className={cx.cardHd}>Free corner side (this run)</div>
          <div className="grid grid-cols-2 items-end gap-1.5">
            {(["left", "right"] as const).map(side => {
              const on = (active.cornerSide ?? "right") === side;
              return (
                <button key={side} onClick={() => onSideChange(side)}
                  className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                  style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>
                  {side === "left" ? "Left" : "Right"}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Linked to <span className="font-semibold">{partner.name}</span>. This run's {active.cornerSide === "left" ? "left" : "right"} edge is the free corner -- no track/screws on that side; the corner kit covers it.
        </p>
      </>
    )}
  />
);

// --- ShaftLinkSelector -----------------------------------------------------------
// Shaft wall (see estimate_shaft_wall.md): a shaft can have a primary stack
// wall and, optionally, a secondary split wall -- each estimated fully
// independently, but sharing one back-to-back C-track junction where the
// secondary splits off (per user clarification -- not stated explicitly in
// the doc). No side selector needed here (unlike Corner wall): the two stack
// walls don't share an edge orientation, just the one junction component.
export const ShaftLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => (
  <WallLinkSelector
    heading="Secondary split wall"
    walls={walls} active={active}
    filter={w => w.orient === "horizontal" && w.wallSystem === "shaft" && (w.shaftPartnerId == null || w.shaftPartnerId === active.id)}
    partnerId={active.shaftPartnerId}
    onLink={onLink}
    note={partner => (
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {partner
          ? <>Linked to <span className="font-semibold">{partner.name}</span>. Both stack walls are estimated independently, plus a shared back-to-back C-track junction where they split.</>
          : "Link this wall to a secondary split stack wall if the shaft has one, to calculate the shared back-to-back junction track."}
      </p>
    )}
  />
);

// --- JunctionLinkSelector -----------------------------------------------------
// Generic wall-to-wall adjoining link, available on ANY wall regardless of
// orientation or wallSystem -- unlike Corner/Shaft wall's partner links,
// this isn't tied to a specific wallSystem's own kit. It only produces an
// extra C/J track allowance when the two linked walls have different
// orientations (see src/estimate/calculateConnectionMaterials.ts); linking
// two walls of the same orientation is harmless (no material is added) but
// isn't the intended use, so the note below is explicit about that.
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
// --- PanelTypeSelector -----------------------------------------------------------
// "Panel configuration" block: the 3-way P51/P64/P78 button grid, or (for
// Shaft wall, which is always 78 mm -- not a user choice) a static badge
// instead of a disabled grid.
const PanelTypeSelector = ({ active, update, topBorder }: {
  active: Wall; update: (patch: Partial<Wall>) => void; topBorder: boolean;
}) => (
  <div className={topBorder ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
    <div className={cx.cardHd}>Panel configuration</div>
    {active.wallSystem === "shaft" ? (
      <div className="rounded-xl border-2 py-3 px-4 text-center" style={{ borderColor: BLUE, background: BLUE }}>
        <div className="text-base font-black leading-none tracking-tight text-white">78 mm</div>
        <div className="mt-1 text-xs font-semibold tracking-wide text-white/70">Shaft wall is always 78 mm - 120 min FRL</div>
      </div>
    ) : (
      <div className="grid grid-cols-3 items-end gap-1.5">
        {TYPES.map(t => {
          const on = active.type === t.id;
          return (
            <button key={t.id} onClick={() => update({ type: t.id })}
              className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
              style={on ? { borderColor: BLUE, background: BLUE } : undefined}>
              <div className="text-base font-black leading-none tracking-tight" style={{ color: on ? "#fff" : BLUE }}>{t.label}</div>
              <div className="mt-1 text-xs font-semibold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>{t.depth}</div>
              <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : "#94a3b8" }}>FRL {t.frl}</div>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

// --- WallTabsAndActions -----------------------------------------------------------
// Wall tab strip (+ Add) and the active wall's name/duplicate/delete toolbar.
const WallTabsAndActions = ({ walls, results, activeId, setActiveId, active, update, addBlankWall, duplicateWall, deleteWall, warnById, topBorder }: {
  walls: Wall[]; results: WallResult[]; activeId: number; setActiveId: (id: number) => void;
  active: Wall; update: (patch: Partial<Wall>) => void;
  addBlankWall: () => void; duplicateWall: () => void; deleteWall: () => void;
  warnById: Record<number, boolean>; topBorder: boolean;
}) => (
  <div className={topBorder ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
    <div className={cx.cardHd}>Walls ({walls.length})</div>
    <div className="flex flex-wrap gap-2 pb-1">
      {results.map(({ wall: w, out: r }) => {
        const on = w.id === activeId;
        return (
          <button key={w.id} onClick={() => setActiveId(w.id)}
            className={"relative rounded-xl border-2 px-3.5 py-3 text-left active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={on ? { borderColor: BLUE, background: BLUE } : undefined}>
            {warnById[w.id] && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} />}
            <div className="max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold" style={{ color: on ? "#fff" : NAVY }}>{w.name}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>
              {w.orient === "vertical" ? "Vert" : "Horiz"} · P{w.type}{r.empty ? "" : ` · ${r.area} m2`}
            </div>
          </button>
        );
      })}
      <button onClick={addBlankWall}
        className="shrink-0 rounded-xl border-2 border-dashed px-3.5 py-3 text-left active:scale-95 transition-all bg-white dark:bg-slate-800"
        style={{ borderColor: BLUE }}>
        <div className="flex items-center gap-1">
          <Plus size={14} style={{ color: BLUE }} />
          <span className="text-sm font-bold" style={{ color: BLUE }}>Add</span>
        </div>
        <div className="mt-1 text-xs font-medium text-transparent">-</div>
      </button>
    </div>
    <div className="flex items-center gap-2 mt-2">
      <input value={active.name} onChange={e => update({ name: e.target.value })} maxLength={32} className={cx.wallName} style={{ color: NAVY }} />
      <IconButton onClick={duplicateWall} title="Duplicate"><Copy size={15} /></IconButton>
      <IconButton onClick={deleteWall} disabled={walls.length === 1} variant="danger" title="Delete"><Trash2 size={15} /></IconButton>
    </div>
  </div>
);

// --- WallsCard ----------------------------------------------------------------
export interface WallsCardProps {
  walls: Wall[]; results: WallResult[];
  activeId: number; setActiveId: (id: number) => void;
  active: Wall; update: (patch: Partial<Wall>) => void;
  addBlankWall: () => void; duplicateWall: () => void; deleteWall: () => void;
  warnById: Record<number, boolean>; showTypes?: boolean;
  systemSelector?: React.ReactNode; // optional system buttons rendered at the top
  orient?: "vertical" | "horizontal"; // gates the horizontal-only wall system dropdown
  onCornerLink?: (targetId: number | null) => void; // Corner wall run linking (internal only)
  onShaftLink?: (targetId: number | null) => void; // Shaft wall primary/secondary linking (internal only)
  onJunctionLink?: (targetId: number | null) => void; // Generic adjoining-wall linking -- any orient/wallSystem, Internal or External
}
export const WallsCard = ({ walls, results, activeId, setActiveId, active, update, addBlankWall, duplicateWall, deleteWall, warnById, showTypes = true, systemSelector, orient, onCornerLink, onShaftLink, onJunctionLink }: WallsCardProps) => (
  <div className={cx.section}>
    {/* 1 -- System selector */}
    {systemSelector && (
      <div>
        {systemSelector}
      </div>
    )}
    {/* 1b -- Horizontal-only wall system dropdown (Standard / Corner / Shaft). Internal
        only -- Standard/Corner/Shaft wall calculation logic doesn't apply to External. */}
    {showTypes && orient === "horizontal" && (
      <>
        <WallSystemSelector
          value={active.wallSystem}
          onChange={id => update(id === "shaft" ? { wallSystem: id, type: 78 } : { wallSystem: id })}
        />
        {active.wallSystem === "corner" && onCornerLink && (
          <CornerLinkSelector
            active={active} walls={walls}
            onLink={onCornerLink}
            onSideChange={side => update({ cornerSide: side })}
          />
        )}
        {active.wallSystem === "shaft" && onShaftLink && (
          <ShaftLinkSelector active={active} walls={walls} onLink={onShaftLink} />
        )}
      </>
    )}
    {/* 1c -- Generic adjoining-wall junction link. Not gated by showTypes/
        orient/wallSystem -- available on every wall in either calculator
        (Internal or External), since a junction can occur between any two
        walls in the project (see JunctionLinkSelector). */}
    {onJunctionLink && walls.length > 1 && (
      <JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} />
    )}
    {/* 2 -- Panel configuration (internal only). Shaft wall is always 78 mm --
        hidden rather than shown-but-disabled, since it's not a user choice. */}
    {showTypes && (
      <PanelTypeSelector active={active} update={update} topBorder={!!systemSelector} />
    )}
    {/* 3 -- Wall tabs + name + actions */}
    <WallTabsAndActions
      walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
      active={active} update={update} addBlankWall={addBlankWall}
      duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById}
      topBorder={showTypes || !!systemSelector}
    />
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
