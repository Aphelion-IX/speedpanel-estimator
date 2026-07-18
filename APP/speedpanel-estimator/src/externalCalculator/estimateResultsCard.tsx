// =============================================================================
// Estimate Results card (External)
// =============================================================================
// Replaces project mode's old SectionNav + four stacked full-width sections
// with one card, tabbed Overview / Selected Wall / Connections / Order --
// mirrors internalCalculator/estimateResultsCard.tsx, minus anything
// Corner/Shaft-kit-shaped (External has no wallSystem concept at all): no
// kit count/cards in Overview/Connections. "System breakdown" (every wall's
// own card, stacked) isn't ported here either -- superseded by the Estimate
// Structure nav + Selected Wall tab.
// =============================================================================
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
import { Card, Row, StatsGrid, WarningsList } from "../ui/primitives";
import { Tabs, TabPanel } from "../ui/tabs";
import { ConnectionBreakdownCard, type PanelScheduleCard } from "../ui/scheduleCards";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { ComputeOut, Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallEstimateCardsExt } from "./mainSections";
import { OrderContent } from "./orderContent";
import { MetricsGridPhone } from "./phoneShell";
import { WarningsListPhone } from "./phoneSections";

function collectProjectWarnings(results: WallResult[], combinedEstimate: CombinedEstimate): string[] {
  return [
    ...results.flatMap(r => r.out.warnings ?? []),
    ...combinedEstimate.connectionWarnings,
  ];
}

export const EstimateResultsCard = ({
  layoutMode, results,
  projAgg, combinedEstimate,
  active, out, orient, ScheduleComp,
}: {
  layoutMode: EffectiveLayout;
  results: WallResult[];
  projAgg: ReturnType<typeof buildExtProjAgg>; combinedEstimate: CombinedEstimate;
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal";
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const projectWarnings = collectProjectWarnings(results, combinedEstimate);

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
            { value: `${projAgg.totalArea} m2`, label: "Total area" },
            { value: projAgg.panels, label: "Total panels" },
            { value: results.length, label: "Walls" },
            { value: projectWarnings.length, label: "Warnings" },
          ];
          // Phone: MetricsGridPhone (blue/navy only, no gold top-border) --
          // same colour rule as the rest of the External phone estimator.
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
          <WallEstimateCardsExt active={active} out={out} orient={orient} layoutMode={layoutMode} ScheduleComp={ScheduleComp} />
        )}
      </TabPanel>

      <TabPanel id="connections" activeId={activeTab}>
        <ConnectionBreakdownCard connections={combinedEstimate.connections} />
      </TabPanel>

      <TabPanel id="order" activeId={activeTab}>
        <OrderContent layoutMode={layoutMode} projAgg={projAgg} combinedEstimate={combinedEstimate} />
      </TabPanel>
    </div>
  );
};
