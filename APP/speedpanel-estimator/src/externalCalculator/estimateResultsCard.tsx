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
import { Layers } from "lucide-react";
import { NAVY } from "../styleTokens";
import { Row, WarningsList } from "../ui/primitives";
import { TabPanel } from "../ui/tabs";
import { ConnectionBreakdownCard, type PanelScheduleCard } from "../ui/scheduleCards";
import { buildExtProjAgg } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { ComputeOut, Wall, WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { WallEstimateCardsExt } from "./mainSections";
import { OrderContent } from "./orderContent";
import { MetricsGridPhone } from "./phoneShell";
import { WarningsListPhone } from "./phoneSections";

// Web's own mockup-ported `.tabs` pill bar -- mirrors
// internalCalculator/estimateResultsCard.tsx's fork-local tab bar (see its
// header comment for why this doesn't reuse the sitewide ui/tabs.tsx
// <Tabs>, which is also used outside the estimator).
const RESULTS_TABS = [
  { id: "overview", label: "Overview" },
  { id: "wall", label: "Selected Wall" },
  { id: "connections", label: "Connections" },
  { id: "order", label: "Order" },
] as const;

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
  const overviewStats = [
    { value: `${projAgg.totalArea} m2`, label: "Total area" },
    { value: projAgg.panels, label: "Total panels" },
    { value: results.length, label: "Walls" },
    { value: projectWarnings.length, label: "Warnings" },
  ];

  return (
    <section className="card results">
      <div className="results-top">
        <div><span className="eyebrow">Project estimate</span><h2><Layers size={14} className="inline mr-1.5 align-[-2px]" />Breakdown &amp; order</h2></div>
        <div className="tabs">
          {RESULTS_TABS.map(t => (
            <button key={t.id} className={t.id === activeTab ? "active" : ""} onClick={() => setActiveTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="results-body">
        <TabPanel id="overview" activeId={activeTab}>
          {/* Phone: MetricsGridPhone (blue/navy only, no gold top-border) --
              same colour rule as the rest of the External phone estimator.
              Web uses the mockup's own flat `.overview-grid`/`.overview-card`
              tiles rather than the sitewide gold-accented StatsGrid, whose
              styling stays untouched for its other call sites. */}
          {layoutMode === "phone" ? <MetricsGridPhone stats={overviewStats} /> : (
            <div className="overview-grid">
              {overviewStats.map(s => (
                <div key={s.label} className="overview-card"><span>{s.label}</span><strong>{s.value}</strong></div>
              ))}
            </div>
          )}
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
    </section>
  );
};
