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
import { ClipboardList, Frame } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { aggregate } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { KitEntry } from "../estimate/synthesizeKits";
import type { ComputeOut, Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { Card, CardGrid, Row, StatsGrid, WarningsList } from "../ui/primitives";
import { Tabs, TabPanel } from "../ui/tabs";
import { ConnectionBreakdownCard, PanelScheduleCard } from "../ui/scheduleCards";
import { CornerKitCard, ShaftJunctionCard } from "./kitCards";
import { WallEstimateCards } from "./mainSections";
import { OrderContent } from "./orderContent";
import { MetricsGridPhone } from "./phoneShell";
import { WarningsListPhone } from "./phoneSections";

function collectProjectWarnings(results: WallResult[], kits: KitEntry[], combinedEstimate: CombinedEstimate): string[] {
  return [
    ...results.flatMap(r => r.out.warnings ?? []),
    ...kits.flatMap(k => k.result.warnings),
    ...combinedEstimate.connectionWarnings,
  ];
}

export const EstimateResultsCard = ({
  layoutMode, results, walls, kits,
  projChosenAgg, combinedEstimate,
  active, out, orient, cornerPair, shaftPair, ScheduleComp,
}: {
  layoutMode: EffectiveLayout;
  results: WallResult[]; walls: Wall[]; kits: KitEntry[];
  projChosenAgg: ReturnType<typeof aggregate>; combinedEstimate: CombinedEstimate;
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal";
  cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const projectWarnings = collectProjectWarnings(results, kits, combinedEstimate);

  return (
    <div className="mt-3">
      <div className={cx.card}>
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
      </div>

      <TabPanel id="overview" activeId={activeTab}>
        {(() => {
          const overviewStats = [
            { value: `${projChosenAgg.totalArea} m2`, label: "Total area" },
            { value: projChosenAgg.totalPanels, label: "Total panels" },
            { value: results.length, label: "Walls" },
            { value: kits.length, label: "Connection kits" },
            { value: `${r1(projChosenAgg.wastePct)}%`, label: "Est. waste" },
            { value: projectWarnings.length, label: "Warnings" },
          ];
          // Phone: MetricsGridPhone (blue/navy only, no gold top-border) --
          // same colour rule as the rest of the Internal phone estimator.
          // Web keeps the shared gold-accented StatsGrid/Stat unchanged.
          return (
            <Card title="Estimate Summary" icon={<ClipboardList size={14} />}>
              {layoutMode === "phone" ? <MetricsGridPhone stats={overviewStats} /> : <StatsGrid stats={overviewStats} />}
            </Card>
          );
        })()}
        {layoutMode === "phone"
          ? <WarningsListPhone warnings={projectWarnings} emptyLabel="No active warnings for this project." />
          : <WarningsList warnings={projectWarnings} />}
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
        <OrderContent layoutMode={layoutMode} projChosenAgg={projChosenAgg} combinedEstimate={combinedEstimate} results={results} />
      </TabPanel>
    </div>
  );
};
