// =============================================================================
// Internal Calculator -- main-column sections
// =============================================================================
// The three sections InternalCalculator's mainNode composes: the collapsible
// "Selected wall estimate" (single-wall mode), the wall-by-wall "System
// breakdown", and the whole-project "Easy to order" summary (project mode).
// No shared logic between them beyond what's already in ../estimate and
// ../ui -- split out purely to keep InternalCalculator.tsx to its own state
// wiring + composition.
// =============================================================================
import { Box, Layers, Hammer } from "lucide-react";
import { cx } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { aggregate, type AggPanelEntry, type AggCustomEntry } from "../estimate/aggregate";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { ComputeOut, Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { SectionLabel, CardGrid, StatsRow, NotesList, Card, Row } from "../ui/primitives";
import { PACK, STOCK_LENGTHS } from "../data";
import { PanelScheduleCard, FixingSealantCard, StockGroupRow, PackNote, ScheduleRow } from "../ui/scheduleCards";
import { CornerKitCard, ShaftVerticalCard, ShaftSlabCard, ShaftJunctionCard } from "./kitCards";
import { TrackFlashingCardInt, TrackFlashingCardIntProj } from "./trackFlashingCards";
import { SystemBreakdownWallCard } from "./systemBreakdownCard";

// --- SingleWallEstimateContent -----------------------------------------------
// Single-wall mode's "Calculator Workspace" card content: stats, panel
// schedule, tracks/flashing, corner/shaft kit cards, fixings/sealant. Used to
// be its own "Wall estimate -- {name}" accordion; now rendered plainly inside
// InternalCalculator's always-visible WorkspaceCard instead (no open/close
// state of its own), with a placeholder shown until there's a valid estimate.
export const SingleWallEstimateContent = ({
  active, out, orient, layoutMode, ScheduleComp, walls, cornerPair, shaftPair,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  ScheduleComp: typeof PanelScheduleCard;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
}) => {
  if (out.empty || !out.chosen || out.chosen.invalid) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        Enter wall dimensions in Wall geometry to see the estimate here.
      </p>
    );
  }
  const chosen = out.chosen;
  return (
    <div>
      <StatsRow area={`${out.area} m2`} panels={chosen.panels} panelType={`P${active.type}`} />
      <CardGrid layoutMode={layoutMode} minWidth={420}>
        <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
          customSchedule={out.customSchedule}
          groups={chosen.groups}
          packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
          wastePct={chosen.wastePct} orient={orient} />
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
  );
};

// --- SystemBreakdownSection --------------------------------------------------
// "System breakdown": shows HOW the combined estimate was built, wall by wall.
export const SystemBreakdownSection = ({ layoutMode, results, walls, ScheduleComp }: {
  layoutMode: EffectiveLayout; results: WallResult[]; walls: Wall[]; ScheduleComp: typeof PanelScheduleCard;
}) => (
  <>
    <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
    <CardGrid layoutMode={layoutMode} minWidth={420}>
      {results.map(({ wall: w, out: o }) => (
        <SystemBreakdownWallCard key={w.id} wall={w} out={o} walls={walls} ScheduleComp={ScheduleComp} />
      ))}
    </CardGrid>
  </>
);

// --- EasyToOrderSection -------------------------------------------------------
// "Easy to order -- combined material summary": WHAT needs to be ordered,
// one combined material list for the whole project.
export const EasyToOrderSection = ({ layoutMode, projChosenAgg, panelType, combinedEstimate, results }: {
  layoutMode: EffectiveLayout; projChosenAgg: ReturnType<typeof aggregate>; panelType: number;
  combinedEstimate: CombinedEstimate; results: WallResult[];
}) => (
  <>
    <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
    <StatsRow
      area={projChosenAgg ? `${projChosenAgg.totalArea} m2` : "--"}
      panels={projChosenAgg ? projChosenAgg.totalPanels : "--"}
      panelType={`P${panelType}`}
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
);
