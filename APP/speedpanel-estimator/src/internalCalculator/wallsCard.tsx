// =============================================================================
// Walls card (Internal Calculator only)
// =============================================================================
// Wall-list management UI: horizontal-only wall system selector (Standard/
// Corner/Shaft) plus its Corner/Shaft/generic junction link pickers, and the
// WallsCard itself (system buttons, panel type, name/duplicate/delete).
//
// Forked from what used to be a single file shared with ExternalCalculator
// (see externalCalculator/wallsCard.tsx for its own, independent copy) --
// External never used the Corner/Shaft/panel-type pieces here (it always
// called WallsCard with showTypes=false and no onCornerLink/onShaftLink), so
// keeping one shared file meant every Internal-only change (colours, new
// controls) had to be checked against "does this leak into External" first.
// Splitting them means each calculator can now evolve its own UI freely.
// =============================================================================
import { Copy, Trash2 } from "lucide-react";
import { cx, NAVY, BLUE, MUTED, selectedFill, selectableOffCx } from "../styleTokens";
import { TYPES } from "../data";
import { IconButton } from "../ui/primitives";
import type { Wall } from "../estimate/wall.types";
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

// The mockup's own `.seg` segmented control (speedpanel-estimator-web-v5.html
// data-seg="system").
const WallSystemSelector = ({ value, onChange }: { value: WallSystemId; onChange: (id: WallSystemId) => void }) => (
  <div>
    <label className="label">Wall system</label>
    <div className="seg">
      {WALL_SYSTEMS.map(([id, label]) => (
        <button key={id} type="button" className={value === id ? "active" : ""} onClick={() => onChange(id)}>
          {label.replace(" wall", "")}
        </button>
      ))}
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
    <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
      <div className={cx.cardHd}>{heading}</div>
      <div className="space-y-1.5">
        <button onClick={() => onLink(null)}
          className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (!partner ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
          style={!partner ? { ...selectedFill, color: "#fff" } : { color: BLUE }}>
          Not linked
        </button>
        {linkable.map(w => {
          const on = partner?.id === w.id;
          return (
            <button key={w.id} onClick={() => onLink(w.id)}
              className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
              style={on ? { ...selectedFill, color: "#fff" } : { color: BLUE }}>
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
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
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
                  className={"w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
                  style={on ? { ...selectedFill, color: "#fff" } : { color: BLUE }}>
                  {side === "left" ? "Left" : "Right"}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
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
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
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
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-400">
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
export const PanelTypeSelector = ({ active, update, topBorder, headingLabel = "Panel configuration" }: {
  active: Wall; update: (patch: Partial<Wall>) => void; topBorder: boolean; headingLabel?: string;
}) => (
  <div className={topBorder ? "border-t border-slate-100 dark:border-slate-700 pt-3" : ""}>
    <div className={cx.cardHd}>{headingLabel}</div>
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
              className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (on ? "" : `border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 ${selectableOffCx}`)}
              style={on ? selectedFill : undefined}>
              <div className="text-base font-black leading-none tracking-tight" style={{ color: on ? "#fff" : BLUE }}>{t.label}</div>
              <div className="mt-1 text-xs font-semibold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>{t.depth}</div>
              <div className="mt-1 text-[10px] font-bold tracking-wide" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>FRL {t.frl}</div>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

// --- WallNameAndActions -----------------------------------------------------------
// The active wall's name input + duplicate/delete toolbar -- split out from
// WallTabsAndActions so a caller that hides the tab strip (Internal's
// Estimate Structure nav supersedes it, see WallsCard's hideWallTabs prop)
// can still keep rename/duplicate/delete available.
// deleteWall is no longer gated on walls.length here -- deleting the sole
// remaining wall is confirm-gated by the caller instead (see
// InternalCalculator.tsx's handleDeleteWall/confirmClearLastWall), which
// clears it back to blank rather than silently no-opping a disabled button.
export const WallNameAndActions = ({ active, update, duplicateWall, deleteWall }: {
  active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void;
}) => (
  <div className="flex items-center gap-2 mt-2">
    <input value={active.name} onChange={e => update({ name: e.target.value })} maxLength={32} className={cx.wallName} style={{ color: NAVY }} />
    <IconButton onClick={duplicateWall} title="Duplicate"><Copy size={15} /></IconButton>
    <IconButton onClick={deleteWall} variant="danger" title="Delete"><Trash2 size={15} /></IconButton>
  </div>
);

// --- WallsCard ----------------------------------------------------------------
export interface WallsCardProps {
  walls: Wall[];
  active: Wall; update: (patch: Partial<Wall>) => void;
  duplicateWall: () => void; deleteWall: () => void;
  showTypes?: boolean;
  systemSelector?: React.ReactNode; // optional system buttons rendered at the top
  orient?: "vertical" | "horizontal"; // gates the horizontal-only wall system dropdown
  onCornerLink?: (targetId: number | null) => void; // Corner wall run linking
  onShaftLink?: (targetId: number | null) => void; // Shaft wall primary/secondary linking
  onJunctionLink?: (targetId: number | null) => void; // Generic adjoining-wall linking -- any orient/wallSystem
}
export const WallsCard = ({ walls, active, update, duplicateWall, deleteWall, showTypes = true, systemSelector, orient, onCornerLink, onShaftLink, onJunctionLink }: WallsCardProps) => (
  <section className="card config-card">
    <div className="card-hd">
      <div className="section-title"><span className="dot" /><span>Wall setup</span></div>
      <div className="wall-actions">
        <IconButton onClick={duplicateWall} title="Duplicate"><Copy size={15} /></IconButton>
        <IconButton onClick={deleteWall} variant="danger" title="Delete"><Trash2 size={15} /></IconButton>
      </div>
    </div>
    <div className="config-body">
      {/* 0 -- Wall name. */}
      <div className="config-row" style={{ gridTemplateColumns: "1fr" }}>
        <div><label className="label">Wall name</label><input className="input" value={active.name} onChange={e => update({ name: e.target.value })} maxLength={32} /></div>
      </div>
      {/* 1 -- System selector */}
      {systemSelector && (
        <div>
          {systemSelector}
        </div>
      )}
      {/* 1b -- Horizontal-only wall system dropdown (Standard / Corner / Shaft). */}
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
          orient/wallSystem -- available on every wall in the project (see
          JunctionLinkSelector). */}
      {onJunctionLink && walls.length > 1 && (
        <JunctionLinkSelector active={active} walls={walls} onLink={onJunctionLink} />
      )}
      {/* 2 -- Panel configuration. Shaft wall is always 78 mm -- hidden rather
          than shown-but-disabled, since it's not a user choice. */}
      {showTypes && (
        <PanelTypeSelector active={active} update={update} topBorder={!!systemSelector} />
      )}
    </div>
  </section>
);
