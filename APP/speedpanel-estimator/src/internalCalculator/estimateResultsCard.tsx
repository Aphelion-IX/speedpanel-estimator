// =============================================================================
// Estimate Results card
// =============================================================================
// Replaces project mode's old SectionNav + four stacked full-width sections
// (Wall list / System breakdown / Connection breakdown / Easy to order) with
// one card, tabbed Overview / Selected Wall / Connections / Order --
// secondary navigation inside this card, not top-level buttons, per the
// user's spec. "System breakdown" (every wall's own card, stacked) isn't
// ported here -- it's superseded by the Estimate Structure nav + Selected
// Wall tab (click a wall in the nav, read its own breakdown).
// =============================================================================
import { useState } from "react";
import { Box, Frame, Hammer } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { PACK, STOCK_LENGTHS } from "../data";
import { aggregate, type AggPanelEntry, type AggCustomEntry } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { ComputeOut, Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { Card, CardGrid, Row, StatsGrid, WarningsList } from "../ui/primitives";
import { Tabs, TabPanel } from "../ui/tabs";
import { WallsSummaryTable } from "../ui/wallsCard";
import { ConnectionBreakdownCard, PanelScheduleCard, StockGroupRow, PackNote, ScheduleRow } from "../ui/scheduleCards";
import { CornerKitCard, ShaftJunctionCard } from "./kitCards";
import { TrackFlashingCardIntProj, ConnectionMaterialsCardInt } from "./trackFlashingCards";
import { WallEstimateCards } from "./mainSections";

function collectProjectWarnings(results: WallResult[], kits: KitEntry[], combinedEstimate: CombinedEstimate): string[] {
  return [
    ...results.flatMap(r => r.out.warnings ?? []),
    ...kits.flatMap(k => k.result.warnings),
    ...combinedEstimate.connectionWarnings,
  ];
}

export const EstimateResultsCard = ({
  layoutMode, results, walls, kits, activeId, onSelectWall, warnById, toDisp, dimUnit,
  projChosenAgg, combinedEstimate,
  active, out, orient, cornerPair, shaftPair, ScheduleComp,
}: {
  layoutMode: EffectiveLayout;
  results: WallResult[]; walls: Wall[]; kits: KitEntry[];
  activeId: number; onSelectWall: (id: number) => void;
  warnById: Record<number, boolean>; toDisp: (m: string) => string; dimUnit: string;
  projChosenAgg: ReturnType<typeof aggregate>; combinedEstimate: CombinedEstimate;
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal";
  cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const projectWarnings = collectProjectWarnings(results, kits, combinedEstimate);

  return (
    <div className="mt-3">
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "wall", label: "Selected Wall" },
          { id: "connections", label: "Connections" },
          { id: "order", label: "Order" },
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
      />

      <TabPanel id="overview" activeId={activeTab}>
        <StatsGrid stats={[
          { value: `${projChosenAgg.totalArea} m2`, label: "Total area" },
          { value: projChosenAgg.totalPanels, label: "Total panels" },
          { value: results.length, label: "Walls" },
          { value: kits.length, label: "Connection kits" },
          { value: `${r1(projChosenAgg.wastePct)}%`, label: "Est. waste" },
          { value: projectWarnings.length, label: "Warnings" },
        ]} />
        <div className="mt-3">
          <WallsSummaryTable results={results} activeId={activeId} setActiveId={onSelectWall} warnById={warnById} toDisp={toDisp} dimUnit={dimUnit} />
        </div>
        <WarningsList warnings={projectWarnings} />
      </TabPanel>

      <TabPanel id="wall" activeId={activeTab}>
        <p className="mb-3 text-sm font-semibold" style={{ color: NAVY }}>Selected wall: {active.name}</p>
        {out.empty ? (
          <Row k="Enter width and height to estimate this wall" v="--" dim />
        ) : (
          <WallEstimateCards
            active={active} out={out} orient={orient} layoutMode={layoutMode}
            ScheduleComp={ScheduleComp} walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
          />
        )}
      </TabPanel>

      <TabPanel id="connections" activeId={activeTab}>
        <ConnectionBreakdownCard connections={combinedEstimate.connections} />
        <div className="mt-3">
          {kits.length === 0 ? (
            <Card title="Corner/shaft kits" icon={<Frame size={14} />}>
              <Row k="No corner/shaft kits linked yet" v="--" dim />
            </Card>
          ) : (
            <CardGrid layoutMode={layoutMode} minWidth={360}>
              {kits.map(k => (
                k.kind === "corner"
                  ? <CornerKitCard key={k.id} kit={k.result as CornerPairResult} partnerName={k.wallBName} />
                  : <ShaftJunctionCard key={k.id} kit={k.result as ShaftPairResult} partnerName={k.wallBName} />
              ))}
            </CardGrid>
          )}
        </div>
      </TabPanel>

      <TabPanel id="order" activeId={activeTab}>
        <CardGrid layoutMode={layoutMode} minWidth={300}>
          <Card title="Panels" icon={<Box size={14} />}>
            {projChosenAgg.panels.length > 0 ? (
              <>
                {projChosenAgg.panels.map((p: AggPanelEntry, i: number) => (
                  <StockGroupRow key={i}
                    stock={p.stock} ordered={p.ordered} pieces={p.pieces}
                    packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
                    stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.panels.length - 1}
                    typeLabel={`P${p.type}`}
                    packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
                  />
                ))}
                <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(projChosenAgg.wastePct)}%`} dim /></div>
              </>
            ) : (
              <Row k="No panels yet" v="--" dim />
            )}
          </Card>

          <TrackFlashingCardIntProj agg={projChosenAgg} />

          <ConnectionMaterialsCardInt
            agg={projChosenAgg}
            connectionLM={combinedEstimate.connectionLM}
            connectionPieces={combinedEstimate.connectionPieces}
          />

          <Card title="Fixing and sealant -- whole project" icon={<Hammer size={14} />}>
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
          </Card>

          <Card title="Special/custom items" icon={<Box size={14} />}>
            {projChosenAgg.customPanels.length > 0 ? (
              projChosenAgg.customPanels.map((s: AggCustomEntry, i: number) => (
                <div key={i}>
                  <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.customPanels.length - 1} />
                  {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
                </div>
              ))
            ) : (
              <Row k="No custom-length items" v="--" dim />
            )}
          </Card>
        </CardGrid>
      </TabPanel>
    </div>
  );
};
