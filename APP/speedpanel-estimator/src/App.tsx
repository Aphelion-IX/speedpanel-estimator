import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  Layers, AlertTriangle, Lock, ChevronDown, RotateCcw,
  Box, Frame, Hammer, Plus, Trash2, Copy, Settings,
  Smartphone, Monitor, Sun, Moon, Menu, X,
  FileText, ChevronRight,
  RectangleHorizontal, CornerDownRight, Building2, Shield, RectangleVertical, Check, HelpCircle, Phone,
  CloudRain, Warehouse, Clapperboard, DoorOpen, Building, SquareParking, Wrench, LayoutPanelLeft,
} from "lucide-react";
import { useLayoutMode, type EffectiveLayout } from "./useLayoutMode";
import { useThemeMode, type EffectiveTheme } from "./useThemeMode";
import {
  type PanelType, type SystemConfig,
  PANELS, TYPES, typeFromPackSize,
  PACK, CTRACK_DIM, JTRACK_DIM, MAX_H_HORIZ,
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ, CORNER_POST_TABLE, SHAFT_TRACK_TABLE,
  PANEL_WIDTH, STOCK_WASTE_THRESHOLD, STOCK_LENGTHS, FLASH_STOCK, FIX_PER_BOX,
  HORIZ_CTRACK_STOCK, JTRACK_STOCK, SEALANT_PER_BOX,
  FLASH_DIM, EXT_HORIZ_COVER_DIM, MAX_W_HORIZ, MAX_W_HORIZ_STD_51_64,
  STEEL_MAX_H_VERT, CUSTOM_MAX_LENGTH, SHAFT_MAX_W, SHAFT_MAX_F,
  RAKE_NOTE, HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL,
  EXT_STOCK, EXT_PACK, EXT_SEALANT_PER_BOX, EXT_ZFLASH_STOCK,
  EXT_JTRACK_STOCK, EXT_CTRACK_STOCK,
  EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM, EXT_STOCKED_COLOURS, COLOUR_HEX,
  INT_CONFIG, EXT_CONFIG, INT_LOCKED, EXT_LOCKED,
} from "./data";
import { useCombinedEstimateCalc } from "./estimate/useCombinedEstimateCalc";
import type { ConnectionMaterial } from "./estimate/estimate.types";
import { NAVY, BLUE, GOLD, WHITE, MUTED, cx } from "./styleTokens";
import type {
  EdgeState, Wall, ComputeOut, PanelGroup, PackResult, CustomScheduleEntry,
  ExtResult, WallResult, WallInput, Geometry, SpanValidation, PiecesResult,
  TrackLM, HorizCtrack, FixingsResult, DimField,
} from "./estimate/wall.types";
import { useWallStore, useWallResults } from "./wallStore";
import type { WallStore } from "./wallStore";
import {
  CardGrid, SectionLabel, Num, UnitToggle, ToggleSwitch, StatsRow,
  NotesList, ProjectLockNote, Card, Row,
} from "./ui/primitives";
import { EducationHub } from "./education/EducationHub";

// --- Compute engine -- see ./estimate/* -------------------------------------
// The wall/panel-packing/project-aggregation compute engine now lives in
// src/estimate/ (mathUtils, computeUtils, packPanels, spanLookups,
// gableGeometry, wallGeometry, wallPieces, wallFixings, wallSchedule,
// computeWall, cornerShaftKits, aggregate). Only what's still used directly by
// the UI below is imported.
import { r1, clamp } from "./estimate/mathUtils";
import { plural, stockStatus, makeToDisp, makeToM } from "./estimate/computeUtils";
import { packPanels, buildOption } from "./estimate/packPanels";
import { compute, computeExternal } from "./estimate/computeWall";
import { computeCornerPair, computeShaftPair } from "./estimate/cornerShaftKits";
import type { CornerPairResult, ShaftPairResult } from "./estimate/cornerShaftKits";
import { aggregate, buildExtProjAgg } from "./estimate/aggregate";
import type { CTrackAggEntry, AggPanelEntry, AggCustomEntry, ExtAggGroup } from "./estimate/aggregate";

// --- Locked system data -------------------------------------------------------
// INT_LOCKED / EXT_LOCKED (display-only reference tables) now live in ./data.
const DataRow = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 last:border-0">
    <span className="shrink-0 text-sm font-medium text-slate-400 dark:text-slate-500">{k}</span>
    <span className="text-right text-sm font-semibold text-slate-700 dark:text-slate-200">{v}</span>
  </div>
);
const LDRow = ({ row }: { row: string[] }) =>
  row.length === 1
    ? <div className={cx.ldHead}>{row[0].replace(/-/g, "")}</div>
    : <DataRow k={row[0]} v={row[1]} />;
const LockedDataInt = () => <div className={cx.ldWrap}>{INT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;
const LockedDataExt = () => <div className={cx.ldWrap}>{EXT_LOCKED.map((r, i) => <LDRow key={i} row={r} />)}</div>;

// SPAN_TABLE_VERT / SPAN_TABLE_HORIZ and the panel TYPES list now live in ./data
// (derived from the PANELS catalog).

// --- Wall and system config ---------------------------------------------------
const SYSTEMS = [
  { id: "int-vert",  label: "Vertical",   sub: "Internal Wall", ext: false, orient: "vertical"   as const },
  { id: "int-horiz", label: "Horizontal", sub: "Internal Wall", ext: false, orient: "horizontal" as const },
  { id: "ext-vert",  label: "Vertical",   sub: "External Wall", ext: true,  orient: "vertical"   as const },
  { id: "ext-horiz", label: "Horizontal", sub: "External Wall", ext: true,  orient: "horizontal" as const },
];


// --- LengthExplorer -----------------------------------------------------------
// Shows every candidate stock length with a waste bar so the user can
// instantly compare waste across all options.
const LengthExplorer = ({
  pieces, stocks, packType, currentStock, onSelect, isExt
}: {
  pieces: number[]; stocks: number[]; packType: number;
  currentStock: string; onSelect: (v: string) => void; isExt?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    if (!pieces || !pieces.length) return [];
    return stocks.map(s => {
      const raw = packPanels([...pieces], s, stocks, false);
      if (raw.exceeds || raw.tooShort) return null;
      const result = buildOption(raw, packType);
      const panels = result.panels ?? 1;
      const offcutPerPanel = panels > 0 ? (result.offcut ?? 0) / panels : 0;
      // % of the stock length that is cut off each panel
      const offcutPct = s > 0 ? Math.round((offcutPerPanel / s) * 1000) / 10 : 0;
      return {
        stock: s,
        label: `${r1(s)} m`,
        panels: result.panels,
        packs: result.packs,
        ordered: result.orderedInPacks,
        offcutPct,
        isSelected: currentStock === String(s),
      };
    }).filter(Boolean);
  }, [pieces, stocks, packType, currentStock]);

  const autoRaw = useMemo(() => {
    if (!pieces || !pieces.length) return null;
    const raw = packPanels([...pieces], null, stocks, false);
    if (raw.exceeds || !raw.groups || !raw.groups.length) return null;
    return buildOption(raw, packType);
  }, [pieces, stocks, packType]);

  const selectedOption = options.find(o => o && o.isSelected);
  const autoSelected = !currentStock;

  const headerLabel = autoSelected
    ? "Length: automatic"
    : selectedOption
      ? `Length: ${selectedOption.label}`
      : "Length: automatic";

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-blue-50/60 dark:bg-blue-950/40 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-900/40"
      >
        <span style={{ color: autoSelected ? "#94a3b8" : NAVY }}>{headerLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {/* Auto option */}
          <button
            onClick={() => { onSelect(""); setOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${autoSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
          >
            <div>
              <div className="text-sm font-semibold" style={{ color: autoSelected ? BLUE : NAVY }}>
                {autoSelected && "✓ "}Automatic
              </div>
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {autoRaw ? `Best fit — ${autoRaw.panels} panels, ${Math.round(((autoRaw.offcut ?? 0) / (autoRaw.panels || 1) / ((autoRaw.groups?.[0]?.stock) || 1)) * 1000) / 10}% cut/panel` : "Let the estimator choose"}
              </div>
            </div>
            {autoSelected && <div className="text-xs font-bold uppercase tracking-widest" style={{ color: BLUE }}>Selected</div>}
          </button>

          {/* Per-length options */}
          {options.map(opt => {
            if (!opt) return null;
            const isSelected = opt.isSelected;
            return (
              <button
                key={opt.stock}
                onClick={() => { onSelect(String(opt.stock)); setOpen(false); }}
                className={`w-full px-4 py-3 text-left transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-bold" style={{ color: isSelected ? BLUE : NAVY }}>
                    {isSelected && "✓ "}{opt.label}
                  </span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{opt.offcutPct}% cut</span>
                </div>
                {/* Waste bar — wider = more cut off, scaled to 50% max */}
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, opt.offcutPct * 2)}%`, background: BLUE, opacity: 0.35 }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {opt.panels} panels · {opt.packs} pack{opt.packs !== 1 ? "s" : ""} · {opt.ordered} ordered
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};


/**
 * One linear-metre material line item, e.g. "C-track perimeter -- 55x82x50"
 * with a piece count on the right and an "X m total -- stocked @ Y m" subline.
 * Used by every track/flashing card (internal + external, single wall + project).
 */
const LMLineItem = ({ label, pieces, lm, stockLabel, bordered = true }: {
  label: string; pieces: number; lm: number; stockLabel: string; bordered?: boolean;
}) => (
  <div className={bordered ? cx.rowBorder : undefined}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - {stockLabel}</div>
  </div>
);

// typeFromPackSize now lives in ./data.

/** "Head track flashing" card -- identical layout in all four track/flashing card variants. */
const HeadFlashingCard = ({ dim, pieces, lm, stock }: { dim: string; pieces: number; lm: number; stock: number }) => (
  <Card title="Head track flashing" icon={<Layers size={14} />}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{dim}</span>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{pieces} length{plural(pieces)}</span>
    </div>
    <div className={cx.rowSub}>{lm} m total - stocked @ {r1(stock)} m</div>
    <Row k="Fixing layout" v="2 rows @ 500, stag. 250" dim />
  </Card>
);

/** Corner wall kit -- the shared post, corner screws, corner sealant, and corner
 * protection strip for a linked pair of runs (see estimate_free_corner_wall.md
 * Part 2). Shown identically on both linked walls. */
const CornerKitCard = ({ kit, partnerName }: { kit: CornerPairResult; partnerName: string }) => (
  <Card title="Corner kit" icon={<Frame size={14} />}>
    <p className={`mb-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500`}>Shared with {partnerName} -- calculated once per corner.</p>
    <LMLineItem
      label={`Corner post - ${kit.section}`}
      pieces={kit.postPieces} lm={kit.postLM}
      stockLabel={`stocked @ ${r1(kit.postStock)} m`} />
    <Row k={`Corner screws - ${kit.fixPerCourse}/course, both sides`} v={`${kit.cornerScrews} (${kit.cornerScrewBoxes} box${plural(kit.cornerScrewBoxes)})`} hl />
    <Row k="Corner sealant" v={`${kit.cornerSealantBoxes} box${plural(kit.cornerSealantBoxes)} (${kit.cornerSausages} sausages)`} hl />
    <LMLineItem
      label="Corner protection strip"
      pieces={kit.stripPieces} lm={kit.stripLM}
      stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);

/** Shaft wall's own vertical track / floors / slab-pass card (see estimate_shaft_wall.md). */
const ShaftVerticalCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Vertical track" icon={<Frame size={14} />}>
    {out.vertTrackSection ? (
      <>
        <div className={`mb-3 ${cx.infoBox}`}>
          <div className={cx.infoBoxHd}>Selected vertical track section</div>
          <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.vertTrackSection}</div>
          <div className={cx.infoBoxSub}>{out.vertTrackFixPerCourse} fixing{(out.vertTrackFixPerCourse || 1) > 1 ? "s" : ""} each side, per course{out.floors ? ` - ${out.floors} floor${plural(out.floors)}` : ""}</div>
        </div>
        <LMLineItem
          label={`Both vertical edges - +100mm overlap per floor`}
          pieces={out.vertTrackPieces || 0} lm={out.vertTrackLM || 0}
          stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
        {out.vertTrackOutsideTable && (
          <p className={`mt-2 ${cx.infoNote}`}>
            <span className="mt-0.5 shrink-0">i</span>
            Floor height exceeds the standard vertical track table -- confirmed conservatively. Contact Speedpanel.
          </p>
        )}
      </>
    ) : (
      <Row k="Vertical track" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall's slab-related quantities: informational anchor count, slab-pass sealant, protection strip. */
const ShaftSlabCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Slab passes" icon={<Layers size={14} />}>
    {out.floors ? (
      <>
        <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${out.slabAnchors || 0}`} dim />
        <Row k="Slab-pass sealant" v={`${out.slabPassSealantBoxes || 0} box${plural(out.slabPassSealantBoxes || 0)} (${out.slabPassSausages || 0} sausages)`} hl />
        <LMLineItem
          label="Protection strip - one length per slab pass + junction"
          pieces={out.stripPieces || 0} lm={out.stripLM || 0}
          stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
      </>
    ) : (
      <Row k="Slab passes" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall back-to-back junction kit, shared between a linked primary + secondary split wall. */
const ShaftJunctionCard = ({ kit, partnerName }: { kit: ShaftPairResult; partnerName: string }) => (
  <Card title="Back-to-back junction" icon={<Frame size={14} />}>
    <p className="mb-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">Shared with {partnerName} -- calculated once per split.</p>
    <div className={`mb-3 ${cx.infoBox}`}>
      <div className={cx.infoBoxHd}>Selected junction track section</div>
      <div className={cx.infoBoxVal} style={{ color: NAVY }}>{kit.section}</div>
      <div className={cx.infoBoxSub}>{kit.fixPerCourse} fixing{kit.fixPerCourse > 1 ? "s" : ""} each side, per course - {kit.floors} floor{plural(kit.floors)}</div>
    </div>
    <LMLineItem
      label="Back-to-back C-track - +100mm overlap per floor"
      pieces={kit.junctionPieces} lm={kit.junctionLM}
      stockLabel={`stocked @ ${r1(kit.junctionStock)} m`} bordered={false} />
    <Row k="Junction screws" v={`${kit.junctionScrews} (${kit.junctionScrewBoxes} box${plural(kit.junctionScrewBoxes)})`} hl />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);

const PackNote = ({ type, spare }: { type: number; spare?: number }) => {
  const msg = spare && spare > 3
    ? `${spare} spare panels -- part-pack options may be available. Contact Speedpanel.`
    : `Under a full pack (${PACK[type]}) -- contact Speedpanel for part-pack options.`;
  return (
    <p className={cx.packNote}>
      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
      {msg}
    </p>
  );
};

const StockBadge = ({ status }: { status: ReturnType<typeof stockStatus> }) => {
  if (status.type === "stocked")
    return <span className={`${cx.badge} bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400`}>Stocked</span>;
  if (status.type === "near-stock")
    return <span className={`${cx.badge} bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400`}>^ {r1(status.length)} m</span>;
  return <span className={`${cx.badge} bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>Custom</span>;
};

const ScheduleRow = ({ mm, ordered, qty, packs, packSize, stocks, isLast, packNumber }: {
  mm: number; ordered: number; qty: number; packs: number; packSize: number; stocks: number[]; isLast: boolean; packNumber?: number;
}) => {
  const status = stockStatus(mm, stocks);
  return (
    <div className={`py-3.5 ${isLast ? "" : "border-b border-slate-100 dark:border-slate-800"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {packNumber != null && (
            <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
              {packs > 1 ? `Pack ${packNumber}-${packNumber + packs - 1}` : `Pack ${packNumber}`}
            </span>
          )}
          <span className="text-base font-bold tracking-tight" style={{ color: NAVY }}>{mm.toLocaleString()} mm</span>
          <StockBadge status={status} />
        </div>
        <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between" style={{fontSize:"14px",color:"#94a3b8"}}>
        <span>{qty} req · {packs} pack{packs !== 1 ? "s" : ""} of {packSize}</span>
        <span>{ordered - qty} spare</span>
      </div>
    </div>
  );
};

// --- SpanTable ----------------------------------------------------------------
const SpanTable = ({ orient, type, wallSystem }: { orient: string; type: number; wallSystem?: WallSystemId }) => {
  const [open, setOpen] = useState(false);
  const TH = "py-2.5 px-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800";
  const TD = "py-2.5 px-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0";
  const TDm = "py-2.5 px-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 last:border-0";
  const label = orient === "vertical" ? `Span table - P${type}` : `C-track span table - P${type}`;

  if (orient === "vertical") {
    const rows = SPAN_TABLE_VERT.filter(r => r.type === `P${type}`);
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Panel</th><th className={TH}>Max W</th><th className={TH}>Max H</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={i} className="bg-blue-50/60 dark:bg-blue-950/40">
                  <td className={TDm} style={{ color: BLUE }}>{r.type}</td>
                  <td className={TD}>{r.maxW}</td>
                  <td className={TD}>{r.maxH}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Height limits apply without steel structure.</div>
          </>
        )}
      </div>
    );
  }

  // "Standard wall" and "Corner wall" (see estimate_single_wall.md and
  // estimate_free_corner_wall.md) both use one fixed C-track section for their
  // own run-level track, regardless of width/height -- no span-table lookup
  // (matches computeHorizCtrack). Show that single section here instead of the
  // generic multi-row span table, so the reference info matches what's
  // actually being ordered. (Corner wall's post has its own separate table,
  // shown inline in the corner-kit card once linked, not here.)
  if (wallSystem === "standard" || wallSystem === "corner") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>{label}</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
              <tbody>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{MAX_W_HORIZ} m</td>
                  <td className={TD}>{MAX_H_HORIZ[type]} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{CTRACK_DIM[type]}</td>
                  <td className={TD}>1/face</td>
                </tr>
              </tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">
              {wallSystem === "standard"
                ? "Standard wall: fixed C-track section, no span-table lookup. All four edges restrained."
                : "Corner wall: fixed C-track section on the supported side. The free-corner post has its own size table -- see the corner kit once linked."}
            </div>
          </>
        )}
      </div>
    );
  }

  // "Shaft wall" (see estimate_shaft_wall.md): vertical track is sized by
  // floor height F alone, not width/height -- an entirely different table
  // shape (SHAFT_TRACK_TABLE) than the generic span table below. Shown here
  // as reference; the actual selection (driven by the wall's own floor
  // height) appears in the Vertical track card once floor height is entered.
  if (wallSystem === "shaft") {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
          <span>Vertical track table - P78</span>
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <>
            <table className="w-full border-t border-slate-100 dark:border-slate-800">
              <thead><tr><th className={TH}>Floor height up to</th><th className={TH}>Vertical track</th><th className={TH}>Screws each side</th></tr></thead>
              <tbody>{SHAFT_TRACK_TABLE.map((r, i) => (
                <tr key={i}>
                  <td className={TDm} style={{ color: NAVY }}>{r.maxF} m</td>
                  <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.section}</td>
                  <td className={TD}>{r.fixPerCourse}/course</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Sized by floor height (slab to soffit), not total shaft height. Total height stacks to any height.</div>
          </>
        )}
      </div>
    );
  }

  const rows = SPAN_TABLE_HORIZ[type] || SPAN_TABLE_HORIZ[78];
  return (
    <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>{label}</span>
        <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <table className="w-full border-t border-slate-100 dark:border-slate-800">
            <thead><tr><th className={TH}>Max W</th><th className={TH}>Max H</th><th className={TH}>C-track</th><th className={TH}>Fix</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className={r.note ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                <td className={TDm} style={{ color: NAVY }}>{r.maxW}</td>
                <td className={TD}>{r.maxH}</td>
                <td className={TD} style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cTrack}</td>
                <td className={TD}>{r.fix}</td>
              </tr>
            ))}</tbody>
          </table>
          {type === 78 && <div className="px-3.5 py-2.5 text-sm text-slate-400 dark:text-slate-500">Stacked/shaft condition (W 4.5-5.0 m): height unlimited for material estimating only.</div>}
        </>
      )}
    </div>
  );
};

// --- ProfileSelector ----------------------------------------------------------
const ProfileSelector = ({ value, onChange }: { value: ProfileId; onChange: (id: ProfileId) => void }) => (
  <div className="grid grid-cols-3 items-end gap-1.5">
    {([ ["standard","Standard"], ["rake","Raked"], ["gable","Gable"] ] as [ProfileId, string][]).map(([id, lbl]) => {
      const on = value === id;
      return (
        <button key={id} onClick={() => onChange(id)}
          className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
          style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
      );
    })}
  </div>
);

// --- WallSystemSelector --------------------------------------------------------
// Horizontal-only wall system variant (Standard / Corner / Shaft), each with its
// own calculation logic: Standard (estimate_single_wall.md -- fixed C-track,
// all edges restrained), Corner (estimate_free_corner_wall.md -- 3-edge runs +
// linked corner post kit), Shaft (estimate_shaft_wall.md -- floor-height-driven
// vertical track + linked back-to-back junction kit). See computeWall's
// normalization block and each system's dedicated step-function branches.
type WallSystemId = "standard" | "corner" | "shaft";
const WALL_SYSTEMS: [WallSystemId, string][] = [
  ["standard", "Standard wall"],
  ["corner",   "Corner wall"],
  ["shaft",    "Shaft wall"],
];

const WallSystemSelector = ({ value, onChange }: { value: WallSystemId; onChange: (id: WallSystemId) => void }) => (
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

// --- CornerLinkSelector ---------------------------------------------------------
// Corner wall (see estimate_free_corner_wall.md): each run is entered as its own
// wall, then linked to its partner run to form a pair sharing one free corner.
// linkable excludes the active wall itself and any wall already linked to a
// third wall (a wall can only be in one pair at a time).
const CornerLinkSelector = ({ active, walls, onLink, onSideChange }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
  onSideChange: (side: "left" | "right") => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id && w.orient === "horizontal" && w.wallSystem === "corner" &&
    (w.cornerPartnerId == null || w.cornerPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.cornerPartnerId);
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className={cx.cardHd}>Corner partner run</div>
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
              {w.name}
            </button>
          );
        })}
      </div>
      {!partner && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Link this run to another Corner wall run to calculate the shared corner post, screws, sealant, and protection strip.
        </p>
      )}
      {partner && (
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
    </div>
  );
};

// --- ShaftLinkSelector -----------------------------------------------------------
// Shaft wall (see estimate_shaft_wall.md): a shaft can have a primary stack
// wall and, optionally, a secondary split wall -- each estimated fully
// independently, but sharing one back-to-back C-track junction where the
// secondary splits off (per user clarification -- not stated explicitly in
// the doc). No side selector needed here (unlike Corner wall): the two stack
// walls don't share an edge orientation, just the one junction component.
const ShaftLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id && w.orient === "horizontal" && w.wallSystem === "shaft" &&
    (w.shaftPartnerId == null || w.shaftPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.shaftPartnerId);
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className={cx.cardHd}>Secondary split wall</div>
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
              {w.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {partner
          ? <>Linked to <span className="font-semibold">{partner.name}</span>. Both stack walls are estimated independently, plus a shared back-to-back C-track junction where they split.</>
          : "Link this wall to a secondary split stack wall if the shaft has one, to calculate the shared back-to-back junction track."}
      </p>
    </div>
  );
};

// --- JunctionLinkSelector -----------------------------------------------------
// Generic wall-to-wall adjoining link, available on ANY wall regardless of
// orientation or wallSystem -- unlike Corner/Shaft wall's partner links,
// this isn't tied to a specific wallSystem's own kit. It only produces an
// extra C/J track allowance when the two linked walls have different
// orientations (see src/estimate/calculateConnectionMaterials.ts); linking
// two walls of the same orientation is harmless (no material is added) but
// isn't the intended use, so the note below is explicit about that.
const JunctionLinkSelector = ({ active, walls, onLink }: {
  active: Wall; walls: Wall[];
  onLink: (targetId: number | null) => void;
}) => {
  const linkable = walls.filter(w =>
    w.id !== active.id &&
    (w.junctionPartnerId == null || w.junctionPartnerId === active.id)
  );
  const partner = walls.find(w => w.id === active.junctionPartnerId);
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className={cx.cardHd}>Adjoining wall (junction)</div>
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
              {w.name} <span className="font-normal" style={{ color: on ? "rgba(255,255,255,0.7)" : MUTED }}>({w.orient === "vertical" ? "Vert" : "Horiz"})</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
        {partner
          ? partner.orient !== active.orient
            ? <>Linked to <span className="font-semibold">{partner.name}</span>. Combined estimate includes an extra C/J track allowance where these two walls meet.</>
            : <>Linked to <span className="font-semibold">{partner.name}</span>. Same orientation -- no extra junction material is added.</>
          : "Mark another wall in this project as physically adjoining this one, so the combined estimate can allow for the extra C/J track needed where a vertical and horizontal wall meet."}
      </p>
    </div>
  );
};

// --- EstimateModeSelector -----------------------------------------------------
const EstimateModeSelector = ({ visible, mode, setMode }: { visible: boolean; mode: string; setMode: (m: string) => void }) => {
  if (!visible) return null;
  return (
    <div className="mt-4 grid grid-cols-2 items-end gap-2">
      {[["single","Selected wall estimate"],["project","Combined wall estimate"]].map(([k, lbl]) => {
        const on = mode === k;
        return (
          <button key={k} onClick={() => setMode(k)}
            className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center active:scale-95 transition-all " + (on ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
            style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { color: BLUE }}>{lbl}</button>
        );
      })}
    </div>
  );
};

// --- WarningsList -------------------------------------------------------------
const WarningsList = ({ warnings }: { warnings?: string[] | null }) => {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-5 space-y-3">
      {warnings.map((w, i) => (
        <div key={i} className={cx.warnbox}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" /><span>{w}</span>
        </div>
      ))}
    </div>
  );
};

// --- EdgeRestraintSelector ----------------------------------------------------
type FinishKey = "headFinish" | "bottomFinish" | "leftFinish" | "rightFinish";
type CornersField = "intCorners" | "extCorners";
type ActiveFinishes = Record<FinishKey, string>;

interface EdgeRestraintProps {
  edges: EdgeState;
  onEdgeToggle: (k: keyof EdgeState) => void;
  options?: { key: string; label: string; sublabel?: string; value: boolean; onToggle: () => void }[];
  orient: string;
  showTrackFinish?: boolean;
  setShowTrackFinish?: (fn: (v: boolean) => boolean) => void;
  activeFinishes?: ActiveFinishes;
  onFinishChange?: (field: FinishKey, val: string) => void;
  corners?: { intCorners: string; extCorners: string; onChange: (field: CornersField, val: string) => void };
  locked?: boolean; // Standard wall: all 4 edges restrained is fixed by the spec, not user-editable
}

const EdgeRestraintSelector = ({
  edges, onEdgeToggle, options = [], orient,
  showTrackFinish, setShowTrackFinish, activeFinishes, onFinishChange,
  corners = { intCorners: "", extCorners: "", onChange: () => {} },
  locked = false,
}: EdgeRestraintProps) => {
  const flashOption = options.find(o => o.key === "headFlash");

  const EdgeBtn = ({ edgeKey, label }: { edgeKey: keyof EdgeState; label: string }) => {
    const on = locked || edges[edgeKey];
    return (
      <button onClick={locked ? undefined : () => onEdgeToggle(edgeKey)} disabled={locked}
        className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-center transition-all " + (locked ? "cursor-default" : "active:scale-95") + (on ? "" : " border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
        style={on ? { borderColor: BLUE, background: BLUE, color: "#fff", opacity: locked ? 0.85 : 1 } : { color: "#94a3b8" }}>
        {on ? "✓ " : ""}{label}
      </button>
    );
  };

  const TrackSwitch = ({ field, label }: { field: FinishKey; label: string }) => {
    const isJ = activeFinishes ? activeFinishes[field] === "J" : false;
    return (
      <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isJ ? "J-track" : "C-track"}</span>
          <button onClick={() => onFinishChange && onFinishChange(field, isJ ? "C" : "J")}
            style={{ background: isJ ? BLUE : "#cbd5e1", width: 44, height: 24, borderRadius: 12, position: "relative", border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 2, left: isJ ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block" }} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={cx.section}>
      {/* Restrained edges */}
      <div>
        <div className={cx.cardHd}>Restrained edges</div>
        <div className="grid grid-cols-2 items-end gap-2">
          <EdgeBtn edgeKey="top" label="Head" />
          <EdgeBtn edgeKey="bottom" label="Base" />
          <EdgeBtn edgeKey="left" label="Left" />
          <EdgeBtn edgeKey="right" label="Right" />
        </div>
        {locked && (
          <p className="mt-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
            Standard wall assumes all four edges restrained (slab, soffit, and structure both sides).
          </p>
        )}
      </div>

      {/* Advanced track selection */}
      {showTrackFinish !== undefined && setShowTrackFinish && (
        <div>
          <button onClick={() => setShowTrackFinish(v => !v)}
            className={`${cx.accordionInner} active:scale-95`}>
            <span>Advanced track selection</span>
            <ChevronDown size={13} className={`text-slate-400 dark:text-slate-500 transition-transform ${showTrackFinish ? "rotate-180" : ""}`} />
          </button>
          {showTrackFinish && (
            <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3">
              {(([
                edges.top    ? { field: "headFinish"   as FinishKey, label: "Head" }   : null,
                edges.bottom ? { field: "bottomFinish" as FinishKey, label: "Base" }   : null,
                edges.left   && orient === "vertical" ? { field: "leftFinish"  as FinishKey, label: "Left" }  : null,
                edges.right  && orient === "vertical" ? { field: "rightFinish" as FinishKey, label: "Right" } : null,
              ]).filter((x): x is { field: FinishKey; label: string } => x !== null)).map(({ field, label }) => (
                <TrackSwitch key={label} field={field} label={label} />
              ))}
              {!edges.top && !edges.bottom && !edges.left && !edges.right && (
                <p className="py-3 text-center text-sm text-slate-400 dark:text-slate-500">No restrained edges selected</p>
              )}
              <p className="py-2.5 text-sm text-slate-400 dark:text-slate-500">J-track available on P78 panels only</p>
            </div>
          )}
        </div>
      )}

      {/* Head track flashing */}
      {flashOption && (
        <div className="flex w-full items-center justify-between rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/40 px-4 py-2">
          <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Head track flashing</span>
          <button onClick={flashOption.onToggle}
            style={{
              background: flashOption.value ? BLUE : "#cbd5e1",
              width: 44, height: 24, borderRadius: 12, position: "relative",
              border: "none", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
            }}>
            <span style={{
              position: "absolute", top: 2, left: flashOption.value ? 22 : 2,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s", display: "block",
            }} />
          </button>
        </div>
      )}

      {/* Other options */}
      {options.filter(o => o.key !== "headFlash").length > 0 && (
        <div className="space-y-2">
          {options.filter(o => o.key !== "headFlash").map(({ key, label, sublabel, value, onToggle }) => (
            <button key={key} onClick={onToggle}
              className={"w-full rounded-xl border-2 py-3.5 px-4 text-sm font-semibold text-left active:scale-95 transition-all " + (value ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
              style={value ? { borderColor: BLUE, background: BLUE, color: "#fff" } : undefined}>
              {value ? "✓ " : ""}{label}
              {sublabel && <span className={`text-sm font-normal ${value ? "text-white/70" : "text-slate-400 dark:text-slate-500"}`}> {sublabel}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Corner angles */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <div className={cx.cardHd}>Corner angles</div>
        <div className="grid grid-cols-2 items-end gap-2">
          <div>
            <div>
              <label className={cx.lbl}>Internal</label>
              <input type="number" inputMode="decimal" value={corners.intCorners}
                onChange={e => corners.onChange("intCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
            </div>
          </div>
          <div>
            <div>
              <label className={cx.lbl}>External</label>
              <input type="number" inputMode="decimal" value={corners.extCorners}
                onChange={e => corners.onChange("extCorners", e.target.value)} className={cx.input} style={{ color: NAVY }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Shared layout components -------------------------------------------------

/** Decorative "Project quantities" section divider used in both calculators. */
const ProjectSeparator = () => (
  <div className="mt-4 mb-2 flex items-center gap-2">
    <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/50" />
    <span className={cx.pill} style={{ background: BLUE }}>Project quantities</span>
    <div className="h-px flex-1 bg-blue-200 dark:bg-blue-900/50" />
  </div>
);

/** Stock-group row used in both project order cards (internal AggPanelEntry / external ExtAggGroup). */
const StockGroupRow = ({ stock, ordered, pieces, packs, packSize, spare, stocks, isLast, typeLabel, packNote }: {
  stock: number; ordered: number; pieces: number; packs: number; packSize: number; spare: number;
  stocks: number[]; isLast: boolean;
  typeLabel?: string; // e.g. "P78" prefix -- omit for external which has no type column
  packNote?: React.ReactNode;
}) => (
  <div className={`py-2 ${!isLast ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold" style={{ color: NAVY }}>
          {typeLabel ? `${typeLabel} - ` : ""}{r1(stock)} m
        </span>
        <StockBadge status={stockStatus(stock * 1000, stocks)} />
      </div>
      <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{ordered} panels</span>
    </div>
    <div className={cx.rowSub}>{pieces} req - {packs} pack{packs !== 1 ? "s" : ""} of {packSize} - {spare} spare</div>
    {packNote}
  </div>
);

interface CustomLengthSectionProps {
  dimUnit: string;
  customLengthInput: string;
  customActive: boolean;
  projectLock: boolean;
  projectStock: string;
  wallCount: number;
  commitCustomLength: (raw: string) => void;
  toggleCustom: () => void;
}

/** Custom-length input + toggle, shared between internal and external calculators. */
const CustomLengthSection = ({ dimUnit, customLengthInput, customActive, projectLock, projectStock, wallCount, commitCustomLength, toggleCustom }: CustomLengthSectionProps) => {
  const parsedM = makeToM(dimUnit)(customLengthInput);
  const numM = parseFloat(parsedM);
  const overMax = numM > CUSTOM_MAX_LENGTH + 1e-9;
  return (
    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Custom length</label>
        <ToggleSwitch active={customActive} label={customActive ? "Active" : "Off"} onToggle={toggleCustom} />
      </div>
      <input
        type="number" inputMode="decimal"
        placeholder={dimUnit === "mm" ? "e.g. 7200" : "e.g. 7.2"}
        value={customLengthInput}
        onChange={e => commitCustomLength(e.target.value)}
        className={`${cx.input} font-medium`}
        style={{
          color: NAVY,
          borderColor: overMax ? "#f59e0b" : customActive ? BLUE : undefined,
          boxShadow: customActive && !overMax ? `0 0 0 2px ${BLUE}22` : undefined,
          opacity: customActive ? 1 : 0.5,
        }} />
      {overMax && customActive && (
        <p className="mt-1.5 flex gap-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Exceeds {CUSTOM_MAX_LENGTH} m maximum -- contact Speedpanel.
        </p>
      )}
      {customActive && numM > 0 && !overMax && projectLock && (
        <ProjectLockNote wallCount={wallCount} stock={projectStock} dimUnit={dimUnit} numM={numM} customActive />
      )}
    </div>
  );
};

// --- PanelScheduleCard --------------------------------------------------------
const PanelScheduleCard = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => (
  <Card title={title} icon={icon}>
    {customSchedule && customSchedule.length > 0 ? (
      <>
        {showCustomNote && (
          <p className={`mb-2 ${cx.footnote}`} style={{paddingTop:0}}>
            {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
          </p>
        )}
        {customSchedule.map((s, i) => (
          <ScheduleRow key={i} mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={packSize} stocks={stocks} isLast={i === customSchedule.length - 1} packNumber={s.packNumber} />
        ))}
        <div className={cx.hr}>
          <Row k="Total required" v={`${customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} />
          <Row k="Total to order" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
          <Row k="Spare" v={`${customSchedule.reduce((a, s) => a + s.ordered, 0) - customSchedule.reduce((a, s) => a + s.qty, 0)} panels`} dim />
        </div>
      </>
    ) : (
      <>
        {(groups || []).map((g, i) => {
          const status = stockStatus(g.stock * 1000, stocks);
          return (
            <div key={i} className={`py-2 ${i < (groups!.length - 1) ? "border-b border-slate-100 dark:border-slate-800" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: NAVY }}>{r1(g.stock)} m</span>
                  <StockBadge status={status} />
                </div>
                <span className="text-base font-bold shrink-0" style={{ color: BLUE }}>{g.ordered} panels</span>
              </div>
              <div className={cx.rowSub}>
                {g.pieces} req · {g.packs} pack{g.packs !== 1 ? "s" : ""} of {g.ps || packSize} · {g.spare} spare
              </div>
              {(g.underPack || g.spare > 3) && <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />}
            </div>
          );
        })}
        {(!groups || groups.length === 0) && <Row k="No panels yet" v="--" dim />}
        <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim /></div>
      </>
    )}
  </Card>
);

// --- PanelScheduleTable ---------------------------------------------------------
// Web/tablet counterpart to PanelScheduleCard: same props, same underlying
// data (stockStatus/StockBadge/PackNote/typeFromPackSize), just rendered as a
// real <table> (matching SpanTable's TH/TD conventions) instead of stacked rows.
const PanelScheduleTable = ({ title, icon, customSchedule, groups, packSize, stocks, wastePct, orient, showCustomNote = true }: {
  title: string; icon: React.ReactNode;
  customSchedule?: CustomScheduleEntry[] | null; groups?: PanelGroup[];
  packSize: number; stocks: number[]; wastePct?: number; orient?: string; showCustomNote?: boolean;
}) => {
  const TH = "py-2.5 px-2 text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800";
  const TD = "py-2.5 px-2 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0";
  const TDm = "py-2.5 px-2 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 last:border-0";
  const hasCustom = customSchedule && customSchedule.length > 0;

  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}>{icon}</span>{title}
      </div>
      {hasCustom && showCustomNote && (
        <p className={`mb-2 ${cx.footnote}`} style={{ paddingTop: 0 }}>
          {orient === "horizontal" ? "Factory-cut row widths." : "Factory-cut panels (max 9000 mm)."} Pack of {packSize}. Confirm with Speedpanel.
        </p>
      )}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[400px]">
        <thead>
          <tr>
            <th className={TH}>{hasCustom ? "Length" : "Stock"}</th>
            <th className={TH}>Status</th>
            <th className={TH}>Req.</th>
            <th className={TH}>Packs</th>
            <th className={TH}>Ord.</th>
            <th className={TH}>Spare</th>
          </tr>
        </thead>
        <tbody>
          {hasCustom ? customSchedule!.map((s, i) => {
            const status = stockStatus(s.mm, stocks);
            return (
              <tr key={i}>
                <td className={TDm} style={{ color: NAVY }}>
                  {s.packNumber != null && (
                    <span className="mr-1.5 rounded-md px-1.5 py-0.5 text-xs font-bold" style={{ background: BLUE, color: "#fff" }}>
                      {s.packs > 1 ? `Pack ${s.packNumber}-${s.packNumber + s.packs - 1}` : `Pack ${s.packNumber}`}
                    </span>
                  )}
                  {s.mm.toLocaleString()} mm
                </td>
                <td className={TD}><StockBadge status={status} /></td>
                <td className={TD}>{s.qty}</td>
                <td className={TD}>{s.packs} of {packSize}</td>
                <td className={TDm} style={{ color: BLUE }}>{s.ordered}</td>
                <td className={TD}>{s.ordered - s.qty}</td>
              </tr>
            );
          }) : (groups || []).map((g, i) => {
            const status = stockStatus(g.stock * 1000, stocks);
            const showNote = g.underPack || g.spare > 3;
            return (
              <Fragment key={i}>
                <tr>
                  <td className={TDm} style={{ color: NAVY }}>{r1(g.stock)} m</td>
                  <td className={TD}><StockBadge status={status} /></td>
                  <td className={TD}>{g.pieces}</td>
                  <td className={TD}>{g.packs} of {g.ps || packSize}</td>
                  <td className={TDm} style={{ color: BLUE }}>{g.ordered}</td>
                  <td className={showNote ? "py-2.5 px-2 text-sm text-slate-600 dark:text-slate-300" : TD}>{g.spare}</td>
                </tr>
                {showNote && (
                  <tr>
                    <td colSpan={6} className="pb-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <PackNote type={typeFromPackSize(g.ps || packSize)} spare={g.spare} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {!hasCustom && (!groups || groups.length === 0) && (
            <tr><td className={TD} colSpan={6}>No panels yet</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div className={cx.hr}>
        {hasCustom ? (
          <>
            <Row k="Total required" v={`${customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} />
            <Row k="Total to order" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0)} panels`} hl />
            <Row k="Spare" v={`${customSchedule!.reduce((a, s) => a + s.ordered, 0) - customSchedule!.reduce((a, s) => a + s.qty, 0)} panels`} dim />
          </>
        ) : (
          <Row k="Wastage (order)" v={`${r1(wastePct || 0)}%`} dim />
        )}
      </div>
    </div>
  );
};

// --- FixingSealantCard --------------------------------------------------------
const FixingSealantCard = ({ title, boxes30, fix30, boxes16, fix16, sealantBoxes, sausages, area, sealantLabel, sealantRate, footnote, p2pNote, p2pEnhanced }: {
  title: string; boxes30: number; fix30: number; boxes16: number; fix16: number;
  sealantBoxes: number; sausages: number; area: number | string;
  sealantLabel: string; sealantRate: number; footnote?: string;
  p2pNote?: string; p2pEnhanced?: boolean;
}) => (
  <Card title={title} icon={<Hammer size={14} />}>
    <Row k="10g 30mm SDS" v={`${boxes30} box${plural(boxes30)}`} hl />
    <Row k="QTY req" v={`${fix30}`} dim />
    <Row k="10g 16mm SDS" v={`${boxes16} box${plural(boxes16)}`} hl />
    <Row k="QTY req" v={`${fix16}`} dim />
    <Row k="Structure fixings (base track)" v="By others / engineer" dim />
    <div className={cx.hr}>
      <Row k={sealantLabel} v={`${sealantBoxes} box${plural(sealantBoxes)} (${sausages} sausages)`} hl />
      <Row k={`area / ${sealantRate} m2/sausage`} v={`${area} m2`} dim />
    </div>
    {p2pEnhanced !== undefined ? (
      <div className="mt-1.5 border-t border-slate-100 dark:border-slate-800 pt-1.5 space-y-1">
        {p2pEnhanced ? (
          <>
            <p className="text-sm font-bold" style={{ color: NAVY }}>P78 vertical &gt; 5.0 m -- enhanced panel-to-panel pattern:</p>
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">Joints 1-2 @500mm - 3-4 @750mm - rest @1000mm - one face.</p>
          </>
        ) : (
          <p className={cx.footnote} style={{paddingTop:0}}>Est. fixings -- 1000/box. {p2pNote}</p>
        )}
      </div>
    ) : (
      <p className={cx.footnote}>{footnote || "Est. fixings -- 1000/box."}</p>
    )}
  </Card>
);

// --- TrackFlashingCardInt -----------------------------------------------------
const TrackFlashingCardInt = ({ out, headFlashActive, wall }: { out: ComputeOut; headFlashActive: boolean; wall?: Wall }) => {
  const jEdges: string[] = [];
  if (wall && out.jLM && out.jLM > 0) {
    if (wall.headFinish   === "J" && wall.edges && wall.edges.top)    jEdges.push("head");
    if (wall.bottomFinish === "J" && wall.edges && wall.edges.bottom) jEdges.push("base");
    if (wall.leftFinish   === "J" && wall.edges && wall.edges.left)   jEdges.push("left");
    if (wall.rightFinish  === "J" && wall.edges && wall.edges.right)  jEdges.push("right");
  }
  const jLabel = jEdges.length > 0 ? jEdges.join(" + ") : "selected edges";
  const isShaft = wall?.wallSystem === "shaft";
  return (
    <>
      <Card title={isShaft ? "Top and bottom track" : "Track and flashing"} icon={<Frame size={14} />}>
        {out.horizProfile && (
          <div className={`mb-3 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track section</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
            {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
          </div>
        )}
        {out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label={isShaft ? `Head + base track - ${out.ctrackDim}` : `C-track perimeter - ${out.ctrackDim}`}
            pieces={out.cPieces || 0} lm={out.cLM}
            stockLabel={`stocked @ ${r1(out.cStock || 0)} m`} />
        ) : (
          <Row k="C-track" v="No C-track edges selected" dim />
        )}
        {out.jLM && out.jLM > 0 && (
          <LMLineItem
            label={`J-track - ${jLabel} - ${out.jtrackDim}`}
            pieces={out.jPieces || 0} lm={out.jLM}
            stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
        )}
        {(!out.cLM || out.cLM === 0) && (!out.jLM || out.jLM === 0) && (
          <div className={cx.rowBorder}><Row k="No track yet" v="--" dim /></div>
        )}
        {wall && wall.wallSystem !== "corner" && wall.wallSystem !== "shaft" && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className={cx.cardHd}>Corner angles</div>
            <Row
              k={`Internal corners${wall.intCorners ? ` x ${wall.intCorners}` : ""}`}
              v={Number(wall.intCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.intCorners) > 0}
              dim={!Number(wall.intCorners)} />
            <Row
              k={`External corners${wall.extCorners ? ` x ${wall.extCorners}` : ""}`}
              v={Number(wall.extCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.extCorners) > 0}
              dim={!Number(wall.extCorners)} />
          </div>
        )}
      </Card>
      {headFlashActive && (
        <HeadFlashingCard dim={out.flashDim || ""} pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={FLASH_STOCK} />
      )}
    </>
  );
};

// --- TrackFlashingCardIntProj -------------------------------------------------
const TrackFlashingCardIntProj = ({ agg, connectionLM = 0, connectionPieces = 0 }: {
  agg: ReturnType<typeof aggregate>; connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg && agg.cTracks.map((c: CTrackAggEntry, i: number) => (
      <div key={i} className={cx.rowBorder}>
        {c.orient === "horizontal" && c.horizProfile && (
          <div className={`mb-1.5 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track - P{c.type}</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{c.horizProfile}</div>
            <div className={cx.infoBoxSub}>{c.horizFix} fixing{c.horizFix > 1 ? "s" : ""} each face - most conservative</div>
          </div>
        )}
        <LMLineItem
          label={c.orient === "horizontal" ? `C-track perimeter - P${c.type}` : `C-track vert P${c.type} - ${CTRACK_DIM[c.type]}`}
          pieces={c.pieces} lm={c.lm} stockLabel={`stocked @ ${r1(c.stock)} m`} bordered={false} />
      </div>
    ))}
    {agg && agg.jLM > 0 && (
      <LMLineItem
        label={`J-track - ${JTRACK_DIM[78]} - 1.15 mm BMT`}
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
    )}
    {agg && agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} />
    )}
    {agg && agg.vertTrackLM > 0 && (
      <LMLineItem
        label="Shaft vertical track (both edges, all shaft walls)"
        pieces={agg.vertTrackPieces} lm={agg.vertTrackLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.cornerPostLM > 0 && (
      <LMLineItem
        label="Corner posts (linked pairs)"
        pieces={agg.cornerPostPieces} lm={agg.cornerPostLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.junctionLM > 0 && (
      <LMLineItem
        label="Back-to-back junctions (linked pairs)"
        pieces={agg.junctionPieces} lm={agg.junctionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.stripLM > 0 && (
      <LMLineItem
        label="Protection strips (corner + shaft)"
        pieces={agg.stripPieces} lm={agg.stripLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    )}
    {connectionPieces > 0 && (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
    )}
    {(!agg || (agg.cTracks.length === 0 && agg.jLM === 0 && agg.flashLM === 0 && agg.vertTrackLM === 0 && agg.cornerPostLM === 0 && agg.junctionLM === 0)) && connectionPieces === 0 && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- TrackFlashingCardExt -----------------------------------------------------
const TrackFlashingCardExt = ({ out, orient, headFlashActive }: { out: ComputeOut; orient: string; headFlashActive: boolean }) => (
  <>
    <Card title="Track and flashing" icon={<Frame size={14} />}>
      {orient === "horizontal" ? (
        <>
          {out.horizProfile && (
            <div className={`mb-2 ${cx.infoBox}`}>
              <div className={cx.infoBoxHd}>Selected C-track section</div>
              <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
              {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
            </div>
          )}
          {out.cLM && out.cLM > 0 ? (
            <LMLineItem
              label={`C-track perimeter - ${out.ctrackDim}`}
              pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`@ ${r1(EXT_CTRACK_STOCK[0])} m`} />
          ) : <Row k="C-track" v="No edges selected" dim />}
        </>
      ) : (
        out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label="C-track - Head + 2 sides"
            pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
        ) : <Row k="C-track" v="No head/side edges selected" dim />
      )}
      {out.jLM && out.jLM > 0 && (
        <LMLineItem
          label="J-track - Base"
          pieces={out.jPieces || 0} lm={out.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
      )}
      {out.zLM && out.zLM > 0 && (
        <LMLineItem
          label="Z-flashing (coloured)"
          pieces={out.zPieces || 0} lm={out.zLM} stockLabel={`${EXT_ZFLASH_DIM} - @ ${r1(EXT_ZFLASH_STOCK)} m`} />
      )}
    </Card>
    {headFlashActive && (
      <HeadFlashingCard
        dim="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={3.0} />
    )}
  </>
);

// --- TrackFlashingCardExtProj -------------------------------------------------
const TrackFlashingCardExtProj = ({ agg, connectionLM = 0, connectionPieces = 0 }: {
  agg: ReturnType<typeof buildExtProjAgg>; connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg.cLM > 0 && (
      <LMLineItem
        label="C-track - Head + 2 sides"
        pieces={agg.cPieces} lm={agg.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
    )}
    {agg.jLM > 0 && (
      <LMLineItem
        label="J-track - Base"
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
    )}
    {agg.zLM > 0 && (
      <LMLineItem
        label="Z-flashing (coloured)"
        pieces={agg.zPieces} lm={agg.zLM} stockLabel={`@ ${r1(EXT_ZFLASH_STOCK)} m`} />
    )}
    {agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`@ ${r1(FLASH_STOCK)} m`} />
    )}
    {connectionPieces > 0 && (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg.cLM === 0 && agg.jLM === 0 && agg.zLM === 0 && connectionPieces === 0 && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- ProfileSection -------------------------------------------------------------
// Profile selector (Standard/Raked/Gable) plus its contextual info note.
// Renders without its own card wrapper -- callers nest this inside the same
// cx.section card as the Dimensions block that follows it. Only the change
// callback differs between the internal and external calculator call sites.
type ProfileId = "standard" | "rake" | "gable";
const ProfileSection = ({ profile, onChange }: { profile: ProfileId; onChange: (id: ProfileId) => void }) => (
  <>
    <div className={cx.cardHd}>Profile</div>
    <ProfileSelector value={profile} onChange={onChange} />
    {profile === "rake" && (
      <p className={cx.infoNote}>
        <span className="mt-0.5 shrink-0">i</span>
        {RAKE_NOTE}
      </p>
    )}
  </>
);

// --- DimensionInputs ----------------------------------------------------------
interface DimensionInputsProps {
  active: Wall; toDisp: (m: string) => string; toM: (d: string) => string;
  updDim: (field: DimField, d: string) => void;
  /** Single callback for non-dimension patch updates. */
  onUpdate: (patch: Partial<Wall>) => void;
  out: ComputeOut; orient: string;
}
const DimensionInputs = ({ active, toDisp, toM, updDim, onUpdate, out, orient }: DimensionInputsProps) => {
  const isShaft = orient === "horizontal" && active.wallSystem === "shaft";
  return (
    <>
      <div className="grid grid-cols-2 items-end gap-2">
        <Num label="Width"  value={toDisp(active.width)}  onChange={v => updDim("width", v)} />
        {active.profile === "standard" && !isShaft && <Num label="Height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />}
        {active.profile === "standard" && isShaft && (
          <>
            <Num label="Total shaft height" value={toDisp(active.height)} onChange={v => updDim("height", v)} />
            <Num label="Floor height (slab to soffit)" value={toDisp(active.floorHeight || "")} onChange={v => updDim("floorHeight", v)} />
          </>
        )}
        {active.profile === "rake" && (
          <>
            <Num label="Left height"  value={toDisp(active.leftH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right height" value={toDisp(active.rightH)} onChange={v => updDim("rightH", v)} />
          </>
        )}
        {active.profile === "gable" && (
          <>
            <Num label="Left eaves height"  value={toDisp(active.leftH || active.eavesH)}  onChange={v => updDim("leftH", v)} />
            <Num label="Right eaves height" value={toDisp(active.rightH || active.eavesH)} onChange={v => updDim("rightH", v)} />
            <Num label="Ridge / apex height" value={toDisp(active.apexH)} onChange={v => updDim("apexH", v)} />
            <Num label="Ridge from left -- blank = centred" value={toDisp(active.ridgeX)} onChange={v => updDim("ridgeX", v)} />
          </>
        )}
      </div>
      {isShaft && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          Shaft wall stacks continuously -- total height drives panel/screw counts; floor height sizes the vertical track (see estimate_shaft_wall.md).
        </p>
      )}
      {!out.empty && (out.maxH || 0) > 6.1 && orient === "vertical" && (
        <p className={cx.infoNote}>
          <span className="mt-0.5 shrink-0">i</span>
          Panels greater than 6.0 m are heavier and harder to handle on site. Speak to Speedpanel about installing a nib.
        </p>
      )}
    </>
  );
};

// --- WallsCard ----------------------------------------------------------------
interface WallsCardProps {
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
const WallsCard = ({ walls, results, activeId, setActiveId, active, update, addBlankWall, duplicateWall, deleteWall, warnById, showTypes = true, systemSelector, orient, onCornerLink, onShaftLink, onJunctionLink }: WallsCardProps) => (
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
    {showTypes && active.wallSystem !== "shaft" && (
      <div className={systemSelector ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
        <div className={cx.cardHd}>Panel configuration</div>
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
      </div>
    )}
    {showTypes && active.wallSystem === "shaft" && (
      <div className={systemSelector ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
        <div className={cx.cardHd}>Panel configuration</div>
        <div className="rounded-xl border-2 py-3 px-4 text-center" style={{ borderColor: BLUE, background: BLUE }}>
          <div className="text-base font-black leading-none tracking-tight text-white">78 mm</div>
          <div className="mt-1 text-xs font-semibold tracking-wide text-white/70">Shaft wall is always 78 mm - 120 min FRL</div>
        </div>
      </div>
    )}
    {/* 3 -- Wall tabs + name + actions */}
    <div className={showTypes || systemSelector ? "border-t border-slate-100 dark:border-slate-800 pt-3" : ""}>
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
        <button onClick={duplicateWall} title="Duplicate" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95"><Copy size={15} /></button>
        <button onClick={deleteWall} disabled={walls.length === 1} title="Delete"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border shadow-sm active:scale-95 ${walls.length === 1 ? "border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-red-400 dark:text-red-400"}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  </div>
);

// --- WallsSummaryTable ----------------------------------------------------------
// Web/tablet-only "all walls at a glance" table. No new state -- driven entirely
// by data already computed by the wall store / useWallResults (results/activeId/warnById);
// clicking a row calls the same setActiveId used by WallsCard's tab strip.
const WallsSummaryTable = ({ results, activeId, setActiveId, warnById, toDisp, dimUnit }: {
  results: WallResult[]; activeId: number; setActiveId: (id: number) => void;
  warnById: Record<number, boolean>; toDisp: (m: string) => string; dimUnit: string;
}) => {
  const TH = "py-2.5 px-3 text-left text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800";
  const TD = "py-2.5 px-3 text-sm text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 last:border-0";
  const TDm = "py-2.5 px-3 text-sm font-semibold border-b border-slate-100 dark:border-slate-800 last:border-0";
  const dim = (m: string) => (m ? `${toDisp(m)} ${dimUnit}` : "--");
  return (
    <div className={`mt-3 ${cx.card}`}>
      <div className={cx.cardTitle} style={{ color: NAVY }}>
        <span style={{ color: BLUE }}><Frame size={14} /></span>Walls ({results.length})
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <th className={TH}>Wall</th>
            <th className={TH}>Orientation</th>
            <th className={TH}>Type</th>
            <th className={TH}>Width</th>
            <th className={TH}>Height</th>
            <th className={TH}>Area</th>
            <th className={TH}>Panels</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ wall, out }) => {
            const on = wall.id === activeId;
            return (
              <tr key={wall.id} onClick={() => setActiveId(wall.id)}
                className={`cursor-pointer transition-colors ${on ? "bg-blue-50/60 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                <td className={TDm} style={{ color: NAVY }}>
                  {warnById[wall.id] && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: GOLD }} />}
                  {wall.name}
                </td>
                <td className={TD}>{wall.orient === "vertical" ? "Vertical" : "Horizontal"}</td>
                <td className={TD}>P{wall.type}</td>
                <td className={TD}>{dim(wall.width)}</td>
                <td className={TD}>{dim(wall.height)}</td>
                <td className={TD}>{out.empty ? "--" : `${out.area} m2`}</td>
                <td className={TD}>{out.empty ? "--" : (out.chosen?.panels ?? out.result?.panels ?? "--")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
};

// --- LayoutModeToggle -----------------------------------------------------------
// Icon button showing whichever layout is currently in effect; click forces
// the other one. Placed in the header next to the reset button.
const LayoutModeToggle = ({ effective, onToggle }: { effective: EffectiveLayout; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "phone" ? "Layout: Phone (click for Web)" : "Layout: Web (click for Phone)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "phone" ? <Smartphone size={16} /> : <Monitor size={16} />}
  </button>
);

// --- ThemeToggle -----------------------------------------------------------
// Icon button showing whichever theme is currently in effect; click forces
// the other one -- same pattern as LayoutModeToggle, placed right next to it.
const ThemeToggle = ({ effective, onToggle }: { effective: EffectiveTheme; onToggle: () => void }) => (
  <button
    onClick={onToggle}
    title={effective === "dark" ? "Theme: Dark (click for Light)" : "Theme: Light (click for Dark)"}
    className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
  >
    {effective === "dark" ? <Moon size={16} /> : <Sun size={16} />}
  </button>
);

// --- TopNav ------------------------------------------------------------------
// Replaces the old logo+title header. Left side: logo + the app's top-level
// feature tabs (only "System Estimator" is wired to real content today -- the
// others render a ComingSoonPanel, see SpeedpanelEstimator). Right side: the
// same ThemeToggle/LayoutModeToggle/reset controls as before, unchanged, plus
// a hamburger menu that only appears below the sm breakpoint. No notification
// bell / profile dropdown -- this app has no accounts to attach them to.
export type TopNavTab = "estimator" | "selector" | "education" | "projects";

const TOP_NAV_ITEMS: { key: TopNavTab; label: string }[] = [
  { key: "estimator", label: "System Estimator" },
  { key: "selector",  label: "System Selector" },
  { key: "education", label: "Education Hub" },
  { key: "projects",  label: "Projects" },
];

const TopNavTabButton = ({ label, active, onClick, className = "" }: { label: string; active: boolean; onClick: () => void; className?: string }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-all ${active ? "" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"} ${className}`}
    style={active ? { background: BLUE, color: WHITE } : undefined}
  >
    {label}
  </button>
);

const TopNav = ({ activeTab, onTabChange, right }: { activeTab: TopNavTab; onTabChange: (t: TopNavTab) => void; right: React.ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="data:image/webp;base64,UklGRrQFAABXRUJQVlA4TKcFAAAvj8ETEMdAkG1Tifsnt7jfIQSWyej/k4Mg26ZYI77UZQwEQNGUWsJ0nnggC2T08OPg718UBr0GEIGEYEu23bCRpEeBoiiKFLrd7vZg/0sVAYJKK+ezIvo/AfLH/3/8///v3/Z/OrzG8TJ0HnmNMcY1lzZUa60l55z3Ws+xVp1b76zeplprLflaa53Raq1HvtbanLhaeaxV/bRx7TflrN49rup5r7/ML7kywTHbuBDMIR3aRhgNcT9tEc6xl+GtRMJwiLk5lIjhmJvDAes+FqEvtop+VDK8exVq/jEvuTIBIdpp5AgYz0qEazq/BpyXzCMZrrEOJRPNwP5gL7kyAaGJvdo4wfOYg1C+GxDyHYBtJJhwzgj8WC+5MgGhyYwIV54ElC8HULsDkq3Cvs/A9lQvuTIBocmMDa5RpuH4dgjHHZBN28A6BeczveTKBIQmMyp89xsE/nbAcQc0yzIAnrI+0kuuTEBoMmW1xJxzjsuljS251npkMmD/KmHLueacFltoDvmotebVshoaRssU1Ad6yZUJCE2mMPR4Sv/clyBjUfpH0JYh8TVk8dWiqC1ZQA7Sb6Th1HYlKWkO3aCK6096yZUJwJpzzuxXNRLzOUGahvMriTQyoLgJL1rRqEeHEuagPM1LrkzQid2yttusDpK040sJk2Hxk6JtCqOfWMExJ/CzvOTKBCvx9zi0/K2Eg4bDj7WoFKUIKZsT9ZAf5SVXrkYmgHgW3ad+PzkMyU/GVuWUTVmcioLzQV5yZYIxMQHEPkXDyr8HWbRwI/QXkUNB86lBSQ/SZYI5MQHELqcBofA9snZ8sV3D6XZoW+9Qkohom1NWUJ+FCQhZDUBiAog9hAxA2M4b8KK1kWpvY6naeVYzVLdV23tJKSKyKuTEQYmT9mr/eUxAaKK2ACQmgNijmgBQmZagBhkZjGOjdZYYsleB3npBYRHZFZw+khUcc0Z/HBMQmhhbABITQNxLFkkDQMhTzhV6+mo0iTP0RboNfRIRObXdiYOyPAcTEJqYWwASE0B8SQAOjWkEWKrHkms9coS1fbXolo9a8xpgLL1N2S5CSnSSrKA8BRMQmgy2ACQmoIpIAlDEyGkIyA6OSR5pfJE+KbWzKWAnDsryFASEJsMtAFvuJABF7HsYwjaP+FcQWu9EP0i3asVJsoLyEEBo4tgCYicBKDLKOYzgmEVNvlu4SajS35W1J0FZvTgoi7SHyOIaewlAEUfel4HAc1YWh2jfxpZob9Og1ynURI1KzP1FgZdkBVX8KNq/GQEo4txSsGCfsRxiNYivIYuvWzW0CUsWneF/ePGixAlVXL8SgCL+nC3RjbYm9u+0GcRrSYdYy4TkJUVB+w0Uub7/dRFpQcMI7TnnXKuMf6dFW4dKzjkflWVwnRDchJREz1fk+v54SXWL4v6VCvR9SJzDBDS3quD5ilzfHz8JvwBeDHyPAzM3N4mK+lxFru/PjOUXsEJPco80ZfE7fwGEmItc3x8T88CJx+MVxvMmiybGpqG5SXq8BETpvj+2PWzNwqTFp6oLjJvco0FdLRK03Y/DwyUApfP+DKwAlu1ol3NfoO/3y6N1JObB4tR2gpX4JlnbTUkjP8mTUh4sI0scLD8gAShyfX9GApwD3284jwzHEcQrBkOTm5DWTIeG04+XOcNxZDjfLwEocn1/Rhq8szyMZ2hykxPqImY2FD8pD5YAFLm+P0O7V5THoyZ32bVkk1VbJwg9VgJQ5Pr+jK1OkR9vY7nNqh0DuwaeUJ/Ds8j1/XEIPpsYHyqdMjiFofPAaSgTJD5Xkev741FXh3TKs9F+yvCUopGMkpZmtIeIjkWu//vP/u6JcElkCOt+in2L/c1vi96lU6L31lvjYotrPlg8S1Q99qiWoT2qa2eL/WaTHNVNKdF767ToXSb9zLN2WR661VpP+eP/P3kGAA=="
            alt="Speedpanel"
            className="h-10 w-auto object-contain shrink-0"
          />
          <div className="hidden md:flex items-center gap-1 overflow-x-auto">
            {TOP_NAV_ITEMS.map(item => (
              <TopNavTabButton key={item.key} label={item.label} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all md:hidden"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="mt-3 flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-sm md:hidden">
          {TOP_NAV_ITEMS.map(item => (
            <TopNavTabButton
              key={item.key} label={item.label} active={activeTab === item.key}
              className="w-full text-left"
              onClick={() => { onTabChange(item.key); setMobileOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- ComingSoonPanel -----------------------------------------------------------
// Placeholder body shown for top-nav tabs that don't have real content yet
// (Projects -- see SpeedpanelEstimator).
const ComingSoonPanel = ({ title }: { title: string }) => (
  <div className={cx.card + " mt-6 text-center"}>
    <p className="text-sm font-bold uppercase tracking-widest" style={{ color: BLUE }}>{title}</p>
    <p className={cx.footnote}>Coming soon.</p>
  </div>
);

// --- System Selector -------------------------------------------------------------
// Wall-type picker landing page for the "System Selector" top-nav tab. Each card's
// "selected" highlight is derived read-only from the live estimator state (system /
// active.wallSystem) passed down from SpeedpanelEstimator -- no local selection state,
// so it can never drift from what the estimator is actually configured with.
//
// NOTE: "Select System" and "View Guide" are intentionally inert stubs for now (no
// onClick wired) -- wiring them to actually switch system/orientation/wallSystem and
// jump to the System Estimator tab is a deliberate follow-up, not done here. When that
// lands: a naive switchSystem(option.system) alone is NOT enough, because active.orient
// is a separate per-wall field from `system` -- WallsCard's Standard/Corner/Shaft
// picker gates on active.orient === "horizontal", not sys.orient. The real wiring will
// need switchOrient(target.orient) (which already resets wallSystem/unlinks partners
// correctly) in addition to switchSystem, or selecting Corner/Shaft after a Vertical
// system would silently leave the wall vertical with no picker visible.
type WallSystemOptionId =
  | "single" | "corner" | "shaft" | "ext-horiz"
  | "external-app" | "separation" | "cinema" | "shaft-app" | "stair" | "intertenancy"
  | "car-park" | "plant-room" | "facade" | "scissor-horiz" | "scissor-vert";

interface WallSystemOption {
  id: WallSystemOptionId;
  group: "basic" | "application";
  title: string;
  description: string;
  note: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  // One of SYSTEMS[].id -- for future wiring + selected-state matching. Left undefined
  // for application cards that don't correspond to one single engineering configuration
  // (e.g. Separation/Cinema/Car Park walls can be built either horizontal or vertical
  // per the product literature) -- those cards never show as "selected" and are
  // descriptive-only until a real mapping is decided.
  system?: string;
  wallSystem?: WallSystemId;  // only set for the horizontal-Internal cards
}

const WALL_SYSTEM_OPTIONS: WallSystemOption[] = [
  { id: "single", group: "basic", title: "Single Wall",
    description: "Straight wall section — horizontal or vertical panel installation.",
    note: "Use this when estimating one continuous wall run, in either orientation.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "corner", group: "basic", title: "Corner Wall",
    description: "Two wall runs meeting at a corner",
    note: "Use this when estimating internal or external corners.",
    icon: CornerDownRight, system: "int-horiz", wallSystem: "corner" },
  { id: "shaft", group: "basic", title: "Shaft Wall",
    description: "Shaft, stair or lift enclosure walls.",
    note: "Use this when wall runs are broken into sections.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "ext-horiz", group: "basic", title: "External Wall",
    description: "External wall system — horizontal or vertical panel installation, with weather-facing finish.",
    note: "Use this for weather-facing applications, in either orientation.",
    icon: Shield, system: "ext-horiz" },

  // --- Application-specific systems ---------------------------------------------
  // Broader use-case catalog from the product literature. Several of these describe
  // the same underlying engineering config as a card above (e.g. External Wall System
  // ~ External Wall, Shaft Wall System ~ Shaft Wall) under different naming -- kept as
  // separate cards per product request rather than deduped/replaced. "Shafts & Risers"
  // was merged into "Shaft Wall System" (both describe the same shaft application).
  { id: "external-app", group: "application", title: "External Wall System",
    description: "External walls, boundary walls, weather-facing walls.",
    note: "Use this for boundary or weather-facing external wall applications.",
    icon: CloudRain, system: "ext-horiz" },
  { id: "separation", group: "application", title: "Separation Wall System",
    description: "Factory, warehouse, fire and acoustic separation walls.",
    note: "Use this for factory or warehouse fire and acoustic separation." ,
    icon: Warehouse },
  { id: "cinema", group: "application", title: "Cinema Wall System",
    description: "High acoustic / fire-rated cinema partition walls.",
    note: "Use this for high acoustic or fire-rated cinema partitions.",
    icon: Clapperboard },
  { id: "shaft-app", group: "application", title: "Shaft Wall System",
    description: "Lift shafts, service shafts, open cores, multi-level shaft divisions, risers.",
    note: "Use this for lift/service shafts, open cores or riser divisions.",
    icon: Building2, system: "int-horiz", wallSystem: "shaft" },
  { id: "stair", group: "application", title: "Stair Wall System",
    description: "Fire stair walls, stairwell separation walls.",
    note: "Use this for fire stair or stairwell separation walls.",
    icon: DoorOpen },
  { id: "intertenancy", group: "application", title: "Intertenancy & Corridor System",
    description: "Apartments, corridors, plasterboard-lined fire/acoustic walls.",
    note: "Use this for apartment, corridor or plasterboard-lined fire/acoustic walls.",
    icon: Building },
  { id: "car-park", group: "application", title: "Car Park System",
    description: "Car park fire/security walls, blockwork alternative, impact areas.",
    note: "Use this for car park fire/security walls or impact areas.",
    icon: SquareParking },
  { id: "plant-room", group: "application", title: "Plant Room System",
    description: "Plant rooms, service rooms, walls with penetrations/apertures.",
    note: "Use this for plant/service rooms or walls needing penetrations.",
    icon: Wrench },
  { id: "facade", group: "application", title: "Façade System",
    description: "External façade/boundary wall applications with pre-finished panel face.",
    note: "Use this for pre-finished external façade or boundary applications.",
    icon: LayoutPanelLeft, system: "ext-horiz" },
  { id: "scissor-horiz", group: "application", title: "Scissor Stair System — Horizontal Orientation",
    description: "78mm horizontal panels fixed to stair stringers.",
    note: "Use this for horizontal scissor-stair installations.",
    icon: RectangleHorizontal, system: "int-horiz", wallSystem: "standard" },
  { id: "scissor-vert", group: "application", title: "Scissor Stair System — Vertical Orientation",
    description: "78mm vertical panels between landings.",
    note: "Use this for vertical scissor-stair installations between landings.",
    icon: RectangleVertical, system: "int-vert" },
];

const WallSystemOptionCard = ({ option, selected }: { option: WallSystemOption; selected: boolean }) => {
  const Icon = option.icon;
  return (
    <div className={cx.card + " h-full flex flex-col gap-3"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <div className="relative">
        <div className="h-20 rounded-lg grid place-items-center border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <Icon size={28} style={{ color: BLUE }} />
        </div>
        {selected && (
          <div className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full shadow-sm" style={{ background: BLUE }}>
            <Check size={14} color={WHITE} strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>{option.title}</div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{option.description}</p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <p className={cx.footnote + " pt-0"}>{option.note}</p>
      </div>
      {/* mt-auto pins the CTA to the bottom regardless of how tall the title/
          description/note above it are -- keeps every card's button aligned
          on the same row once the grid stretches all cards to equal height. */}
      {selected ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
          <Check size={14} /> Selected
        </div>
      ) : (
        // Inert stub for this pass -- no onClick wired yet (see file-level note above).
        <button className="mt-auto w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          Select System
        </button>
      )}
    </div>
  );
};

const SystemSelector = ({ layoutMode, system, activeWallSystem }: {
  layoutMode: EffectiveLayout; system: string; activeWallSystem: WallSystemId;
}) => {
  const isSelected = (option: WallSystemOption) =>
    option.system !== undefined && system === option.system &&
    (option.wallSystem === undefined || activeWallSystem === option.wallSystem);

  const sidebarNode = (
    <>
      <div className={cx.card}>
        <div className={cx.cardTitle}><Layers size={13} style={{ color: BLUE }} />Choose Your Wall System</div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Select the wall type that matches how Speedpanel will be installed in your project.
          You'll enter measurements after you make your selection.
        </p>
        <div className={cx.infoNote}><span>This selector does not calculate or recommend automatically. You're in control.</span></div>
        <div className="mt-4 space-y-3">
          {[
            { n: 1, title: "Choose Orientation", sub: "Horizontal or Vertical", current: true },
            { n: 2, title: "Select Wall Type", sub: "Pick the system that fits your project", current: false },
            { n: 3, title: "Enter Measurements", sub: "Complete the form to calculate your estimate", current: false },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-3">
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                style={step.current ? { background: BLUE, color: WHITE } : { color: MUTED, border: "1px solid #cbd5e1" }}>
                {step.n}
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: step.current ? BLUE : NAVY }}>{step.title}</div>
                <div className="text-xs" style={{ color: MUTED }}>{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className={cx.card + " mt-3"}>
        <div className={cx.cardTitle}><HelpCircle size={13} style={{ color: BLUE }} />Need help choosing?</div>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>View our quick guide to understand each system type.</p>
        {/* Inert stub -- no destination wired yet, see file-level note above. */}
        <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          View Guide <ChevronRight size={14} />
        </button>
        <p className="mt-3 text-center text-xs" style={{ color: MUTED }}>Or contact Speedpanel</p>
        <a href="tel:+61391156666" className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ background: BLUE, color: WHITE }}>
          <Phone size={14} /> +61 3 9115 6666
        </a>
      </div>
    </>
  );

  const mainNode = (
    <>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: NAVY }}>What type of wall are you estimating?</h1>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>Start by selecting how the panels will be installed.</p>
      </div>
      {/* Two clearly separated groups: the 4 core wall-type systems together in one
          card (no more horizontal/vertical split -- Single Wall and External Wall
          each work in either orientation), and the broader application catalog in
          its own card. */}
      <div className={cx.card + " mt-5"}>
        <div className={cx.cardHd}>Basic Systems</div>
        <CardGrid layoutMode={layoutMode} minWidth={260} stretch>
          {WALL_SYSTEM_OPTIONS.filter(o => o.group === "basic").map(o => (
            <WallSystemOptionCard key={o.id} option={o} selected={isSelected(o)} />
          ))}
        </CardGrid>
      </div>

      <div className={cx.card + " mt-5"}>
        <div className={cx.cardHd}>Application-Specific Systems</div>
        <CardGrid layoutMode={layoutMode} minWidth={260} stretch>
          {WALL_SYSTEM_OPTIONS.filter(o => o.group === "application").map(o => (
            <WallSystemOptionCard key={o.id} option={o} selected={isSelected(o)} />
          ))}
        </CardGrid>
      </div>
      <div className="mt-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "rgba(37,99,235,0.12)" }}>
            <FileText size={18} style={{ color: BLUE }} />
          </div>
          <div>
            <div className="text-sm font-bold" style={{ color: NAVY }}>Select a wall system to begin</div>
            <p className={cx.footnote + " pt-1"}>Choose one of the systems above to load the matching estimate form.</p>
          </div>
        </div>
        <svg className="hidden md:block shrink-0" width="140" height="80" viewBox="0 0 140 80" fill="none">
          <path d="M10 70 L10 30 L70 10 L130 30 L130 70 Z" stroke={MUTED} strokeWidth="1" opacity="0.35" />
          <path d="M10 30 L130 30" stroke={MUTED} strokeWidth="1" opacity="0.35" />
          <rect x="55" y="45" width="14" height="25" stroke={MUTED} strokeWidth="1" opacity="0.35" />
          <rect x="20" y="40" width="16" height="14" stroke={MUTED} strokeWidth="1" opacity="0.35" />
          <rect x="100" y="40" width="16" height="14" stroke={MUTED} strokeWidth="1" opacity="0.35" />
        </svg>
      </div>
    </>
  );

  return layoutMode === "web"
    ? (
      <div className="mt-6 grid grid-cols-[340px_1fr] items-start gap-6">
        <aside className="sticky top-5">{sidebarNode}</aside>
        <div className="min-w-0">{mainNode}</div>
      </div>
    )
    : <div className="mt-6">{mainNode}{sidebarNode}</div>;
};


// --- CalculatorShell --------------------------------------------------------
// Composes the same sidebar/main/footer content differently depending on
// layout mode. Phone reproduces today's stacked order exactly (byte-for-byte
// equivalent JSX, just relocated into variables); web arranges it as a sticky
// sidebar + wider main column.
const CalculatorShell = ({ layoutMode, sidebar, main, footer }: {
  layoutMode: EffectiveLayout; sidebar: React.ReactNode; main: React.ReactNode; footer: React.ReactNode;
}) => (
  // No space-y-* here: every child component already carries its own correct
  // top margin (mt-3/mt-5/etc., matching phone layout exactly). space-y-*'s
  // generated selector (> :not([hidden]) ~ :not([hidden])) has HIGHER CSS
  // specificity than a plain utility class like mt-5, so it was silently
  // overriding every child's real margin down to a flat 4px -- the actual
  // cause of web layout's spacing looking compressed/inconsistent vs phone.
  <div className="grid grid-cols-[360px_1fr] items-start gap-6">
    <aside className="sticky top-5">{sidebar}</aside>
    <div className="min-w-0">{main}{footer}</div>
  </div>
);

// --- ExternalCalculator -------------------------------------------------------
// orient is derived from sys.orient in the parent and passed as a prop. The
// wall list comes from the shared `store` (owned by SpeedpanelEstimator) so it
// survives switching in/out of External mode. orient stays in useWallResults'
// dependency array to prevent stale compute if this component is kept mounted
// across orientation switches.
function ExternalCalculator({ store, orient, dimUnit, setDimUnit, systemSelector, layoutMode }: { store: WallStore; orient: "vertical" | "horizontal"; dimUnit: string; setDimUnit: (u: string) => void; systemSelector?: React.ReactNode; layoutMode: EffectiveLayout }) {
  const [extMode, setExtMode] = useState("project");
  const [showTakeoff, setShowTakeoff] = useState(true);
  const [showLocked, setShowLocked] = useState(false);

  const {
    walls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, clearCustomLength,
    linkJunctionPartner,
  } = store;
  const { results, out, warnById } = useWallResults(walls, activeId, computeExternal);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  const project  = extMode === "project";
  const projAgg  = useMemo(() => buildExtProjAgg(results), [results]);
  const combinedEstimate = useCombinedEstimateCalc(walls);

  const edgeOptions = [
    { key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) },
  ];

  const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

  const sidebarNode = (
    <>
      <WallsCard
        walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
        active={active} update={update} addBlankWall={addBlankWall}
        duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById} showTypes={false}
        systemSelector={systemSelector} orient={orient}
        onJunctionLink={linkJunctionPartner}
      />

      <SectionLabel icon={<Box size={13} />}>Panel configuration</SectionLabel>
      <div className={cx.section}>
        {/* P78 badge -- styled to match internal panel type buttons */}
        <div className={cx.cardHd}>Panel type</div>
        {(() => {
          const isCustom = active.colourType === "special";
          const stockedHex = !isCustom && active.colour ? COLOUR_HEX[active.colour] : null;
          const isLight = active.colour === "OW";
          const colourName = !isCustom && active.colour
            ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour)?.label ?? ""
            : "";
          const badgeBg = isCustom ? GOLD : stockedHex ?? BLUE;
          const textColour = isCustom ? NAVY : isLight ? NAVY : "#fff";

          return (
            <div className="w-full rounded-xl border-2 py-3.5 px-3 transition-all" style={{ borderColor: badgeBg, background: badgeBg, transition: "background 0.3s, border-color 0.3s" }}>
              <div className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: textColour }}>
                {isCustom ? "P78 - Custom" : `P78${colourName ? ` - ${colourName}` : ""}`}
              </div>
            </div>
          );
        })()}
        {/* Colour selection */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className={cx.cardHd}>Colour selection</div>
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {[...EXT_STOCKED_COLOURS.map(c => {
              const hex = COLOUR_HEX[c.code];
              const selected = active.colour === c.code && active.colourType === "stocked";
              const isLight = c.code === "OW";
              const textColour = isLight ? NAVY : "#fff";
              return (
                <button key={c.code} onClick={() => update({ colour: c.code, colourType: "stocked" })}
                  className="w-full rounded-xl border-2 py-3 px-1.5 text-center transition-all active:scale-95"
                  style={{
                    background: hex,
                    borderColor: selected ? BLUE : "rgba(0,0,0,0.08)",
                    boxShadow: selected ? `0 0 0 2px ${BLUE}` : undefined,
                  }}>
                  <div className="text-[10px] font-bold uppercase leading-tight truncate"
                    style={{ color: textColour }}>{c.label}</div>
                </button>
              );
            }), (() => {
              const selected = active.colourType === "special";
              return (
                <button key="special" onClick={() => update({ colourType: "special", colour: "" })}
                  className={"w-full rounded-xl border-2 py-3 px-1.5 text-center active:scale-95 transition-all " + (selected ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                  style={selected ? { borderColor: BLUE, background: BLUE } : undefined}>
                  <div className="text-[10px] font-bold uppercase leading-tight"
                    style={{ color: selected ? "#fff" : BLUE }}>Custom</div>
                </button>
              );
            })()]}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
            <ToggleSwitch
              active={projectLock}
              label={projectLock ? "Project locked" : "Lock to project"}
              onToggle={() => {
                const currentStock = projectLock ? projectStock : (active.forcedStock || "");
                setProjectLength(customActive ? "" : currentStock, !projectLock);
                if (projectLock) { clearCustomLength(); }
              }}
            />
          </div>
          <LengthExplorer
            pieces={"pieces" in out && out.pieces ? out.pieces : []}
            stocks={EXT_STOCK}
            packType={78}
            currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
            onSelect={val => {
              clearCustomLength();
              if (projectLock) { setProjectLength(val, true); }
              else { update({ forcedStock: val }); }
            }}
            isExt
          />

          {/* Custom length -- always visible below the dropdown */}
          <CustomLengthSection
            dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
            projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
            commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
          />

          {/* Project lock confirmation for stocked lengths */}
          {projectLock && !customActive && projectStock && (
            <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
          )}
        </div>
      </div>

      <SectionLabel icon={<Frame size={13} />}>Wall geometry</SectionLabel>
      <div className={cx.section}>
        <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
            <div className="flex items-center gap-2">
              <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
            </div>
          </div>
          <DimensionInputs active={active} toDisp={toDisp} toM={toM} updDim={updDim} onUpdate={update} out={out} orient={orient} />
          <SpanTable orient={orient} type={78} />
        </div>
      </div>

      <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
      <EdgeRestraintSelector
        edges={active.edges}
        onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
        options={edgeOptions}
        orient={orient}
        corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
      />

      <WarningsList warnings={!out.empty ? out.warnings : null} />
      <EstimateModeSelector visible={!out.empty} mode={extMode} setMode={setExtMode} />
    </>
  );

  const mainNode = (
    <>
      {!out.empty && !project && out.result && (
        <>
          <button onClick={() => setShowTakeoff(!showTakeoff)} className={cx.accordion}>
            <span>Material quantities</span>
            <ChevronDown size={15} className={`transition-transform ${showTakeoff ? "rotate-180" : ""}`} />
          </button>
          {showTakeoff && (() => {
            const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
            const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
            return (
            <div className="mt-3">
              <StatsRow area={`${out.area} m2`} panels={out.result!.panels} panelType="P78" />
              {active.colour && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
                    <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Colour</span>
                    <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                    {active.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Special order</span>}
                  </div>
              )}
              <CardGrid layoutMode={layoutMode} minWidth={380}>
                <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                  packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={orient} />
                <TrackFlashingCardExt out={out} orient={orient} headFlashActive={active.headFlash} />
                <FixingSealantCard title="Fixing and sealant quantities"
                  boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                  boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                  sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                  sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              </CardGrid>
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </div>
            );
          })()}
        </>
      )}

      {project && (
        <>
          <ProjectSeparator />

          {layoutMode === "web" && (
            <>
              <SectionLabel icon={<Frame size={13} />}>Wall list</SectionLabel>
              <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
            </>
          )}

          {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
          <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
          <CardGrid layoutMode={layoutMode} minWidth={420}>
            {results.map(({ wall: w, out: o }) => (
              <SystemBreakdownWallCardExt key={w.id} wall={w} out={o} ScheduleComp={ScheduleComp} />
            ))}
          </CardGrid>

          {/* Connection Breakdown: shows WHY extra materials were added */}
          <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
          <ConnectionBreakdownCard connections={combinedEstimate.connections} />

          {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
          <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
          <StatsRow area={`${projAgg.totalArea} m2`} panels={projAgg.panels} panelType="P78" />
          <CardGrid layoutMode={layoutMode} minWidth={300}>
            <Card title="Project order estimate" icon={<Box size={14} />}>
              {projAgg.groups.map((g: ExtAggGroup, i: number) => (
                <StockGroupRow key={i}
                  stock={g.stock} ordered={g.ordered} pieces={g.pieces}
                  packs={g.packs} packSize={EXT_PACK} spare={g.spare}
                  stocks={EXT_STOCK} isLast={i === projAgg.groups.length - 1}
                />
              ))}
              {projAgg.groups.length === 0 && <Row k="No panels yet" v="--" dim />}
            </Card>
            <TrackFlashingCardExtProj agg={projAgg}
              connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
            <FixingSealantCard title="Fixing and sealant -- whole project"
              boxes30={projAgg.boxes30} fix30={projAgg.fix30}
              boxes16={projAgg.boxes16} fix16={projAgg.fix16}
              sealantBoxes={projAgg.sealantBoxes} sausages={projAgg.sausages} area={projAgg.totalArea}
              sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
          </CardGrid>
        </>
      )}
    </>
  );

  const footerNode = (
    <>
      <button onClick={() => setShowLocked(!showLocked)} className={cx.accordion}>
        <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400 dark:text-slate-500" /> Locked external system data</span>
        <ChevronDown size={16} className={`text-blue-300 dark:text-blue-700 transition-transform ${showLocked ? "rotate-180" : ""}`} />
      </button>
      {showLocked && <LockedDataExt />}
      <button className={cx.exportBtn}>Export PDF</button>
    </>
  );

  if (layoutMode === "phone") {
    return <div>{sidebarNode}{mainNode}{footerNode}</div>;
  }
  return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
}

// --- SystemBreakdownWallCard ---------------------------------------------------
// One wall's own section of the combined estimate's "System Breakdown" --
// shows HOW that wall's estimate was built (name, orientation, dimensions,
// selected system, materials, C/J allowances, flashing, fixings,
// assumptions/warnings), reusing the exact same single-wall display
// components the "Selected wall estimate" view uses. Collapsible so a large
// project doesn't force scrolling past every wall to reach the Easy to Order
// summary; each wall keeps its own open/closed state.
const SystemBreakdownWallCard = ({ wall, out, walls, ScheduleComp }: {
  wall: Wall; out: ComputeOut; walls: Wall[];
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const cornerPartner = wall.wallSystem === "corner" && wall.cornerPartnerId != null
    ? walls.find(w => w.id === wall.cornerPartnerId) : undefined;
  const cornerKit = cornerPartner ? computeCornerPair(wall, cornerPartner, INT_CONFIG) : null;
  const shaftPartner = wall.wallSystem === "shaft" && wall.shaftPartnerId != null
    ? walls.find(w => w.id === wall.shaftPartnerId) : undefined;
  const shaftKit = shaftPartner ? computeShaftPair(wall, shaftPartner, INT_CONFIG) : null;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, Internal, P{wall.type}
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.chosen?.panels ?? out.result?.panels ?? "--"} panelType={`P${wall.type}`} />
              {out.chosen && !out.chosen.invalid && (
                <ScheduleComp title={`Panel schedule -- P${wall.type}`} icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.chosen.groups}
                  packSize={PACK[wall.type]} stocks={STOCK_LENGTHS}
                  wastePct={out.chosen.wastePct} orient={wall.orient} />
              )}
              <TrackFlashingCardInt out={out} headFlashActive={wall.headFlash} wall={wall} />
              {wall.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
              {cornerKit && <CornerKitCard kit={cornerKit} partnerName={cornerPartner?.name ?? "linked run"} />}
              {shaftKit && <ShaftJunctionCard kit={shaftKit} partnerName={shaftPartner?.name ?? "linked wall"} />}
              {wall.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Hilti CP606 sealant" sealantRate={4}
                p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- ConnectionBreakdownCard ---------------------------------------------------
// Shows WHY each junction material was added -- the source walls, the length/
// quantity, and the reason -- separate from the System Breakdown (which shows
// each wall's OWN materials) so the connection logic stays visible and easy
// to audit independently, per the combined-estimate flow.
const ConnectionBreakdownCard = ({ connections }: { connections: ConnectionMaterial[] }) => (
  <Card title="Connection breakdown" icon={<Frame size={14} />}>
    {connections.length === 0 && (
      <Row k="No adjoining walls linked yet" v="--" dim />
    )}
    {connections.map(c => (
      <div key={c.id} className={cx.rowBorder}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: NAVY }}>Extra C/J track</span>
          <span className={cx.rowVal} style={{ color: BLUE }}>{c.pieces} length{plural(c.pieces)}</span>
        </div>
        <div className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Between <span className="font-semibold">{c.wallAName}</span> ({c.wallAOrient}) and{" "}
          <span className="font-semibold">{c.wallBName}</span> ({c.wallBOrient})
        </div>
        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Length {r1(c.lengthM)} lm - qty {c.quantity} - stocked @ {r1(c.stock)} m - {c.reason}
        </div>
        {c.warnings.map((w, i) => (
          <div key={i} className="mt-1.5 flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{w}</span>
          </div>
        ))}
      </div>
    ))}
  </Card>
);

// --- SystemBreakdownWallCardExt -------------------------------------------------
// External-system counterpart to SystemBreakdownWallCard: one wall's own
// section of the combined estimate's System Breakdown, reusing the same
// single-wall display components the External "Selected wall estimate" view
// uses (colour badge, TrackFlashingCardExt, External fixing/sealant rates).
const SystemBreakdownWallCardExt = ({ wall, out, ScheduleComp }: {
  wall: Wall; out: ComputeOut; ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const colourEntry = wall.colour ? EXT_STOCKED_COLOURS.find(c => c.code === wall.colour) : null;
  const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : wall.colour;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, External, P78
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty || !out.result ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.result.panels} panelType="P78" />
              {wall.colour && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Colour</span>
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                  {wall.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Special order</span>}
                </div>
              )}
              <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                customSchedule={out.customSchedule}
                groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={wall.orient} />
              <TrackFlashingCardExt out={out} orient={wall.orient} headFlashActive={wall.headFlash} />
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// --- Session persistence ------------------------------------------------------
// The current view (which system/orientation, project-vs-single mode, and unit)
// is saved alongside the wall project so reopening the app restores the exact
// screen. Kept separate from the wall data (PROJECT_KEY) since it's parent-level.
const SESSION_KEY = "speedpanel:session";
interface PersistedSession { v: number; system: string; mode: string; dimUnit: string; }
function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !SYSTEMS.some(sys => sys.id === s.system)) return null;
    return s as PersistedSession;
  } catch {
    return null;
  }
}

// --- Main app -----------------------------------------------------------------
export default function SpeedpanelEstimator() {
  const savedSession = loadSession();
  const [system, setSystem] = useState(() => savedSession ? savedSession.system : "int-vert");
  const [mode, setMode]     = useState(() => savedSession ? savedSession.mode : "project");
  const [showData, setShowData]               = useState(false);
  const [showWall, setShowWall]               = useState(true);
  const [showTrackFinish, setShowTrackFinish] = useState(false);
  const [dimUnit, setDimUnit] = useState(() => savedSession ? savedSession.dimUnit : "m");
  const [activeTab, setActiveTab] = useState<TopNavTab>("estimator");
  const { effective: layoutMode, toggleLayout } = useLayoutMode();
  const { effective: themeMode, toggleTheme } = useThemeMode();

  // Persist the current view on change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, system, mode, dimUnit })); } catch { /* ignore */ }
  }, [system, mode, dimUnit]);

  const sys    = SYSTEMS.find(s => s.id === system) || SYSTEMS[0];
  const isExt  = sys.ext;
  const project = mode === "project";

  // Single SHARED wall store (persisted); the External calculator receives the
  // same `store` so walls survive switching in/out of External mode.
  const store = useWallStore({ dimUnit, onWallAdded: () => setShowWall(true) });
  const {
    walls, setWalls, activeId, setActiveId,
    projectStock, projectLock, customLengthInput, customActive,
    active, update, toDisp, toM, updDim,
    setProjectLength, addBlankWall, duplicateWall, deleteWall,
    commitCustomLength, toggleCustom, resetWalls, clearCustomLength,
    linkJunctionPartner,
  } = store;
  // Orientation is per-wall (see Wall.orient) -- this is the ACTIVE wall's own
  // orientation, used only to drive which fields/selectors are shown for it.
  // It must never be applied to every wall (that was the combined-estimate bug).
  const orient = active.orient;
  const { results, out, warnById } = useWallResults(walls, activeId, compute);

  const projChosenAgg = useMemo(() => aggregate(results), [results]);

  const switchDimUnit = (u: string) => { setDimUnit(u); clearCustomLength(); };
  // Deliberate "start over": reset the shared store + view. The persistence
  // effects immediately re-save the clean default, so a later reload stays clear.
  const resetAll     = () => { resetWalls(); setMode("project"); setSystem("int-vert"); setDimUnit("m"); };
  // Switching system no longer clears walls -- the shared store is preserved
  // across every orientation/wall-type change.
  const switchSystem = (id: string) => { setSystem(id); setShowWall(true); };

  // Symmetric corner-wall linking: setting the active wall's partner to
  // targetId also points targetId back at the active wall, and un-links
  // whichever previous partners either wall had (a wall can only be linked to
  // one other wall at a time -- see estimate_free_corner_wall.md, "always 1
  // corner"). Passing targetId === null unlinks the active wall only.
  // cornerSide defaults are set to opposite sides on link so the pair starts
  // as a sensible right-angle corner rather than both runs claiming the same side.
  const linkCornerPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.cornerPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, cornerPartnerId: targetId, cornerSide: "right" as const };
        if (targetId !== null && w.id === targetId) return { ...w, cornerPartnerId: activeId, cornerSide: "left" as const };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, cornerPartnerId: null };
        // If the newly-chosen partner was itself linked to a third wall, break that old link too.
        if (targetId !== null && w.cornerPartnerId === targetId && w.id !== activeId) return { ...w, cornerPartnerId: null };
        return w;
      });
    });
  };

  const cornerPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "corner" || !active.cornerPartnerId) return null;
    const partner = walls.find(w => w.id === active.cornerPartnerId);
    if (!partner) return null;
    return computeCornerPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  // Symmetric shaft-wall linking (primary <-> secondary split), same pattern
  // as linkCornerPartner -- no side field to default here since Shaft wall
  // doesn't have a "which side" concept, just the shared junction.
  const linkShaftPartner = (targetId: number | null) => {
    setWalls(ws => {
      const prevPartnerId = ws.find(w => w.id === activeId)?.shaftPartnerId ?? null;
      return ws.map(w => {
        if (w.id === activeId) return { ...w, shaftPartnerId: targetId };
        if (targetId !== null && w.id === targetId) return { ...w, shaftPartnerId: activeId };
        if (prevPartnerId !== null && w.id === prevPartnerId && w.id !== targetId) return { ...w, shaftPartnerId: null };
        if (targetId !== null && w.shaftPartnerId === targetId && w.id !== activeId) return { ...w, shaftPartnerId: null };
        return w;
      });
    });
  };

  const shaftPair = useMemo(() => {
    if (orient !== "horizontal" || active.wallSystem !== "shaft" || !active.shaftPartnerId) return null;
    const partner = walls.find(w => w.id === active.shaftPartnerId);
    if (!partner) return null;
    return computeShaftPair(active, partner, INT_CONFIG);
  }, [orient, active, walls]);

  const combinedEstimate = useCombinedEstimateCalc(walls);

  // Switches the ACTIVE wall's own orientation (per-wall now -- see Wall.orient),
  // not a global setting, so other walls in a combined project are unaffected.
  // Corner/Shaft wall systems only make sense for horizontal walls, so switching
  // to vertical resets wallSystem back to "standard" and unlinks any partner
  // (mirroring deleteWall's dangling-partner cleanup) to avoid stale state.
  const switchOrient = (o: "vertical" | "horizontal") => {
    if (o === active.orient) return;
    if (o === "vertical") {
      if (active.wallSystem === "corner" && active.cornerPartnerId != null) linkCornerPartner(null);
      if (active.wallSystem === "shaft" && active.shaftPartnerId != null) linkShaftPartner(null);
      update({ orient: o, wallSystem: "standard" });
    } else {
      update({ orient: o });
    }
    setShowWall(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans dark:bg-slate-950" style={{ color: NAVY }}>
      <div className={layoutMode === "web" ? "mx-auto w-full max-w-[1400px] px-6 pb-16 pt-6" : "mx-auto w-full max-w-md px-3 sm:px-4 pb-24 pt-5"}>

        {/* Top nav */}
        <TopNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          right={<>
            <ThemeToggle effective={themeMode} onToggle={toggleTheme} />
            <LayoutModeToggle effective={layoutMode} onToggle={toggleLayout} />
            <button onClick={resetAll} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all">
              <RotateCcw size={16} />
            </button>
          </>}
        />
        <div className="mt-4 h-[2px] w-full rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 55%, ${GOLD} 100%)` }} />

        {activeTab === "selector"  && <SystemSelector layoutMode={layoutMode} system={system} activeWallSystem={active.wallSystem} />}
        {activeTab === "education" && <EducationHub layoutMode={layoutMode} />}
        {activeTab === "projects"  && <ComingSoonPanel title="Projects" />}

        {/* System configuration + calculator body */}
        {activeTab === "estimator" && (() => {
          const findSys = (orientVal: "vertical" | "horizontal", ext: boolean) =>
            SYSTEMS.find(s => s.orient === orientVal && s.ext === ext)!;

          // Two full-weight rows, each with its own small label, so Orientation and
          // Wall type read as two distinct, equally important decisions -- not one
          // primary control with a smaller secondary one attached to it.
          const SystemRows = () => {
            const isHoriz = orient === "horizontal";
            return (
              <div className="space-y-3">
                <div>
                  <div className={cx.cardHd}>Orientation</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => switchOrient("vertical")}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (!isHoriz ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                      style={!isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M3 1.5v10M6.5 1.5v10M10 1.5v10" stroke={!isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isHoriz ? WHITE : BLUE }}>Vertical</span>
                    </button>
                    <button onClick={() => switchOrient("horizontal")}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all flex items-center justify-center gap-1.5 " + (isHoriz ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                      style={isHoriz ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M1.5 3h10M1.5 6.5h10M1.5 10h10" stroke={isHoriz ? WHITE : BLUE} strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isHoriz ? WHITE : BLUE }}>Horizontal</span>
                    </button>
                  </div>
                </div>
                <div>
                  <div className={cx.cardHd}>Wall type</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => switchSystem(findSys(orient, false).id)}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (!isExt ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                      style={!isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: !isExt ? WHITE : BLUE }}>Internal</span>
                    </button>
                    <button onClick={() => switchSystem(findSys(orient, true).id)}
                      className={"w-full rounded-xl border-2 py-3 px-3 text-center active:scale-95 transition-all " + (isExt ? "" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800")}
                      style={isExt ? { borderColor: BLUE, background: BLUE } : undefined}>
                      <span className="text-sm font-bold uppercase tracking-wide" style={{ color: isExt ? WHITE : BLUE }}>External</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          };

          const systemButtons = <SystemRows />;

          if (isExt) return (
            <>
              <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
              <div className="mt-1">
                <ExternalCalculator store={store} orient={orient} dimUnit={dimUnit} setDimUnit={switchDimUnit} systemSelector={systemButtons} layoutMode={layoutMode} />
              </div>
            </>
          );

          const ScheduleComp = layoutMode === "web" ? PanelScheduleTable : PanelScheduleCard;

          const sidebarNode = (
            <>
              <SectionLabel icon={<Settings size={13} />}>System configuration</SectionLabel>
              <WallsCard
                walls={walls} results={results} activeId={activeId} setActiveId={setActiveId}
                active={active} update={update} addBlankWall={addBlankWall}
                duplicateWall={duplicateWall} deleteWall={deleteWall} warnById={warnById}
                showTypes={true} systemSelector={systemButtons} orient={orient}
                onCornerLink={linkCornerPartner}
                onShaftLink={linkShaftPartner}
                onJunctionLink={linkJunctionPartner}
              />

              {/* Profile and dimensions */}
              <SectionLabel icon={<Frame size={13} />}>Wall geometry</SectionLabel>
              <div className={cx.section}>
                <ProfileSection profile={active.profile} onChange={id => update({ profile: id })} />
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={cx.cardHd} style={{marginBottom:0}}>Dimensions</span>
                    <div className="flex items-center gap-2">
                      <UnitToggle unit={dimUnit} setUnit={switchDimUnit} />
                    </div>
                  </div>
                  <DimensionInputs active={active} toDisp={toDisp} toM={toM} updDim={updDim} onUpdate={update} out={out} orient={orient} />
                  <SpanTable orient={orient} type={active.type} wallSystem={active.wallSystem} />
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={cx.cardHd} style={{marginBottom:0,display:"inline"}}>Panel length</span>
                    <ToggleSwitch
                      active={projectLock}
                      label={projectLock ? "Project locked" : "Lock to project"}
                      onToggle={() => {
                        const currentStock = projectLock ? projectStock : (active.forcedStock || "");
                        setProjectLength(customActive ? "" : currentStock, !projectLock);
                        if (projectLock) { clearCustomLength(); }
                      }}
                    />
                  </div>
                  <LengthExplorer
                    pieces={"pieces" in out && out.pieces ? out.pieces : []}
                    stocks={STOCK_LENGTHS}
                    packType={active.type}
                    currentStock={customActive ? "" : (projectLock ? projectStock : (active.forcedStock || ""))}
                    onSelect={val => {
                      clearCustomLength();
                      if (projectLock) { setProjectLength(val, true); }
                      else { update({ forcedStock: val }); }
                    }}
                  />

                  {/* Custom length -- same visual treatment as the panel length selector above */}
                  <CustomLengthSection
                    dimUnit={dimUnit} customLengthInput={customLengthInput} customActive={customActive}
                    projectLock={projectLock} projectStock={projectStock} wallCount={walls.length}
                    commitCustomLength={commitCustomLength} toggleCustom={toggleCustom}
                  />

                  {/* Project lock confirmation for stocked lengths */}
                  {projectLock && !customActive && projectStock && (
                    <ProjectLockNote wallCount={walls.length} stock={projectStock} dimUnit={dimUnit} />
                  )}
                </div>
              </div>

              {/* Tracks and flashing */}
              <SectionLabel icon={<Lock size={13} />}>TRACKS AND FLASHING</SectionLabel>
              <EdgeRestraintSelector
                edges={active.edges}
                onEdgeToggle={k => update({ edges: { ...active.edges, [k]: !active.edges[k] } })}
                options={[{ key: "headFlash", label: HEAD_FLASH_LABEL, sublabel: HEAD_FLASH_SUBLABEL, value: active.headFlash, onToggle: () => update({ headFlash: !active.headFlash }) }]}
                orient={orient}
                locked={orient === "horizontal" && active.wallSystem === "standard"}
                showTrackFinish={showTrackFinish}
                setShowTrackFinish={setShowTrackFinish}
                activeFinishes={{ headFinish: active.headFinish, bottomFinish: active.bottomFinish, leftFinish: active.leftFinish, rightFinish: active.rightFinish }}
                onFinishChange={(field, val) => update({ [field]: val } as Pick<Wall, FinishKey>)}
                corners={{ intCorners: active.intCorners, extCorners: active.extCorners, onChange: (f: CornersField, v: string) => update({ [f]: v } as Pick<Wall, CornersField>) }}
              />

              <WarningsList warnings={!out.empty ? out.warnings : null} />
              <EstimateModeSelector visible={!out.empty} mode={mode} setMode={setMode} />
            </>
          );

          const mainNode = (
            <>
              {/* Single wall estimate */}
              {!out.empty && !project && out.chosen && !out.chosen.invalid && (
                <>
                  <button onClick={() => setShowWall(!showWall)} className={cx.accordion}>
                    <span>Wall estimate -- {active.name}</span>
                    <ChevronDown size={15} className={`transition-transform ${showWall ? "rotate-180" : ""}`} />
                  </button>
                  {showWall && (
                    <div className="mt-3">
                      <StatsRow area={`${out.area} m2`} panels={out.chosen.panels} panelType={`P${active.type}`} />
                      <CardGrid layoutMode={layoutMode} minWidth={420}>
                        <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
                          customSchedule={out.customSchedule}
                          groups={out.chosen.groups}
                          packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
                          wastePct={out.chosen.wastePct} orient={orient} />
                        <TrackFlashingCardInt out={out} headFlashActive={active.headFlash} wall={active} />
                        {active.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
                        {cornerPair && (() => {
                          const partner = walls.find(w => w.id === active.cornerPartnerId);
                          return <CornerKitCard kit={cornerPair} partnerName={partner ? partner.name : "linked run"} />;
                        })()}
                        {shaftPair && (() => {
                          const partner = walls.find(w => w.id === active.shaftPartnerId);
                          return <ShaftJunctionCard kit={shaftPair} partnerName={partner ? partner.name : "linked wall"} />;
                        })()}
                        {active.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
                        <FixingSealantCard title="Fixing and sealant quantities"
                          boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                          boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                          sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                          sealantLabel="Hilti CP606 sealant" sealantRate={4}
                          p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
                      </CardGrid>
                      {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
                    </div>
                  )}
                </>
              )}

              {/* Combined estimate: System Breakdown -> Connection Breakdown -> Easy to Order */}
              {project && (
                <>
                  <ProjectSeparator />

                  {layoutMode === "web" && (
                    <>
                      <SectionLabel icon={<Frame size={13} />}>Wall list</SectionLabel>
                      <WallsSummaryTable results={results} activeId={activeId} setActiveId={setActiveId} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
                    </>
                  )}

                  {/* System Breakdown: shows HOW the estimate was built, wall by wall */}
                  <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
                  <CardGrid layoutMode={layoutMode} minWidth={420}>
                    {results.map(({ wall: w, out: o }) => (
                      <SystemBreakdownWallCard key={w.id} wall={w} out={o} walls={walls} ScheduleComp={ScheduleComp} />
                    ))}
                  </CardGrid>

                  {/* Connection Breakdown: shows WHY extra materials were added */}
                  <SectionLabel icon={<Frame size={13} />}>Connection breakdown</SectionLabel>
                  <ConnectionBreakdownCard connections={combinedEstimate.connections} />

                  {/* Easy to Order: shows WHAT needs to be ordered -- one combined material list */}
                  <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
                  <StatsRow
                    area={projChosenAgg ? `${projChosenAgg.totalArea} m2` : "--"}
                    panels={projChosenAgg ? projChosenAgg.totalPanels : "--"}
                    panelType={`P${active.type}`}
                  />
                  <CardGrid layoutMode={layoutMode} minWidth={300}>
                    <Card title="Project order estimate" icon={<Box size={14} />}>
                      {projChosenAgg && (
                        <>
                          {projChosenAgg.panels.map((p: AggPanelEntry, i: number) => (
                            <StockGroupRow key={i}
                              stock={p.stock} ordered={p.ordered} pieces={p.pieces}
                              packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
                              stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.panels.length - 1 && projChosenAgg.customPanels.length === 0}
                              typeLabel={`P${p.type}`}
                              packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
                            />
                          ))}
                          {projChosenAgg.customPanels.length > 0 && (
                            <>
                              {projChosenAgg.panels.length > 0 && <p className={cx.cardHd + " pt-2 pb-1"}>Custom lengths</p>}
                              {projChosenAgg.customPanels.map((s: AggCustomEntry, i: number) => (
                                <div key={i}>
                                  <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.customPanels.length - 1} />
                                  {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
                                </div>
                              ))}
                            </>
                          )}
                          {projChosenAgg.panels.length === 0 && projChosenAgg.customPanels.length === 0 && <Row k="No panels yet" v="--" dim />}
                          <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(projChosenAgg.wastePct)}%`} dim /></div>
                        </>
                      )}
                      {!projChosenAgg && <Row k="No panels yet" v="--" dim />}
                    </Card>
                    <TrackFlashingCardIntProj agg={projChosenAgg}
                      connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
                    <Card title="Fixing and sealant -- whole project" icon={<Hammer size={14} />}>
                      {projChosenAgg && (
                        <>
                          <Row k="10g 30mm SDS" v={`${projChosenAgg.boxes30} box${plural(projChosenAgg.boxes30)}`} hl />
                          <Row k="QTY req" v={`${projChosenAgg.fix30}`} dim />
                          <Row k="10g 16mm SDS" v={`${projChosenAgg.boxes16} box${plural(projChosenAgg.boxes16)}`} hl />
                          <Row k="QTY req" v={`${projChosenAgg.fix16}`} dim />
                          <Row k="Structure fixings (base track)" v="By others / engineer" dim />
                          <div className={cx.hr}>
                            <Row k="Hilti CP606 sealant" v={`${projChosenAgg.sealantBoxes} box${plural(projChosenAgg.sealantBoxes)} (${projChosenAgg.sausages} sausages)`} hl />
                            <Row k="total area / 4 m2/sausage" v={`${projChosenAgg.totalArea} m2`} dim />
                          </div>
                          {projChosenAgg.slabPassSausages > 0 && (
                            <div className={cx.hr}>
                              <Row k="Slab-pass sealant" v={`${projChosenAgg.slabPassSealantBoxes} box${plural(projChosenAgg.slabPassSealantBoxes)} (${projChosenAgg.slabPassSausages} sausages)`} hl />
                            </div>
                          )}
                          {projChosenAgg.slabAnchors > 0 && (
                            <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${projChosenAgg.slabAnchors}`} dim />
                          )}
                          <p className={cx.footnote}>Est. fixings pooled - 1000/box.</p>
                          {results.some(r => r.out.p2pEnhanced) && (
                            <p className="pt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">One or more P78 vertical walls &gt; 5.0 m: enhanced panel-to-panel pattern applied.</p>
                          )}
                        </>
                      )}
                    </Card>
                  </CardGrid>
                </>
              )}
            </>
          );

          const footerNode = (
            <>
              <button onClick={() => setShowData(!showData)} className={cx.accordion}>
                <span className="flex items-center gap-2"><Lock size={13} className="text-slate-400 dark:text-slate-500" /> Locked system data</span>
                <ChevronDown size={16} className={`text-blue-300 dark:text-blue-700 transition-transform ${showData ? "rotate-180" : ""}`} />
              </button>
              {showData && <LockedDataInt />}
              <button className={cx.exportBtn}>Export PDF</button>
            </>
          );

          if (layoutMode === "phone") return <>{sidebarNode}{mainNode}{footerNode}</>;
          return <CalculatorShell layoutMode={layoutMode} sidebar={sidebarNode} main={mainNode} footer={footerNode} />;
        })()}

        {activeTab === "estimator" && (
          <div className="mt-8 flex gap-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              By using this calculator you acknowledge quantities are estimates only and you will not hold Speedpanel liable for over- or under-ordering. Does not confirm compliance, FRL, engineering, restraint, certification or approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
