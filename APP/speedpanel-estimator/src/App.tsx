import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  Layers, AlertTriangle, Lock, ChevronDown, RotateCcw,
  Box, Frame, Hammer, Settings,
  Smartphone, Monitor, Sun, Moon, Menu, X, Phone,
} from "lucide-react";
import { useLayoutMode, type EffectiveLayout } from "./useLayoutMode";
import { useThemeMode, type EffectiveTheme } from "./useThemeMode";
import {
  type PanelType, type SystemConfig,
  PANELS, TYPES,
  PACK, CTRACK_DIM, JTRACK_DIM,
  SPAN_TABLE_VERT, SPAN_TABLE_HORIZ,
  STOCK_LENGTHS, FLASH_STOCK,
  HORIZ_CTRACK_STOCK, JTRACK_STOCK,
  HEAD_FLASH_LABEL, HEAD_FLASH_SUBLABEL,
  EXT_STOCK, EXT_PACK, EXT_ZFLASH_STOCK,
  EXT_JTRACK_STOCK, EXT_CTRACK_STOCK,
  EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_ZFLASH_DIM, EXT_STOCKED_COLOURS, COLOUR_HEX,
  INT_CONFIG,
} from "./data";
import { useCombinedEstimateCalc } from "./estimate/useCombinedEstimateCalc";
import { NAVY, BLUE, GOLD, WHITE, MUTED, cx } from "./styleTokens";
import type { Wall, ComputeOut, PanelGroup } from "./estimate/wall.types";
import { useWallStore, useWallResults } from "./wallStore";
import type { WallStore } from "./wallStore";
import {
  CardGrid, SectionLabel, UnitToggle, ToggleSwitch, StatsRow,
  NotesList, ProjectLockNote, Card, Row, EstimateModeSelector, WarningsList, CalculatorShell,
} from "./ui/primitives";
import { LockedDataInt, LockedDataExt } from "./ui/lockedData";
import { LengthExplorer } from "./ui/lengthExplorer";
import {
  LMLineItem, HeadFlashingCard, PackNote, ScheduleRow,
  PanelScheduleCard, PanelScheduleTable, FixingSealantCard, StockGroupRow, ConnectionBreakdownCard,
} from "./ui/scheduleCards";
import {
  SpanTable, EdgeRestraintSelector, ProjectSeparator,
  CustomLengthSection, ProfileSection, DimensionInputs,
} from "./ui/wallConfig";
import type { FinishKey, CornersField } from "./ui/wallConfig";
import {
  WallsCard, WallsSummaryTable,
} from "./ui/wallsCard";
import { EducationHub } from "./education/EducationHub";
import { SystemSelector } from "./systemSelector/SystemSelector";

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


// SPAN_TABLE_VERT / SPAN_TABLE_HORIZ and the panel TYPES list now live in ./data
// (derived from the PANELS catalog).

// --- Wall and system config ---------------------------------------------------
const SYSTEMS = [
  { id: "int-vert",  label: "Vertical",   sub: "Internal Wall", ext: false, orient: "vertical"   as const },
  { id: "int-horiz", label: "Horizontal", sub: "Internal Wall", ext: false, orient: "horizontal" as const },
  { id: "ext-vert",  label: "Vertical",   sub: "External Wall", ext: true,  orient: "vertical"   as const },
  { id: "ext-horiz", label: "Horizontal", sub: "External Wall", ext: true,  orient: "horizontal" as const },
];


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



export type WallSystemId = "standard" | "corner" | "shaft";

// --- EstimateModeSelector -----------------------------------------------------





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


// --- CalculatorShell --------------------------------------------------------
// Composes the same sidebar/main/footer content differently depending on
// layout mode. Phone reproduces today's stacked order exactly (byte-for-byte
// equivalent JSX, just relocated into variables); web arranges it as a sticky
// sidebar + wider main column.

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
