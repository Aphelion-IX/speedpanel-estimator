// =============================================================================
// Wall workspace tabs (phone) -- External
// =============================================================================
// Mirrors internalCalculator/wallWorkspaceTabs.tsx -- see its header comment.
// External has no corner/shaft wallSystem concept, so its Schedule tab uses
// WallEstimateCardsExt (no cornerPair/shaftPair), and Connections only ever
// shows the generic junction-partner row (ConnectionsSummary already omits
// the corner/shaft rows unless active.wallSystem is set, which External
// walls never do).
// =============================================================================
import { useState } from "react";
import { Tabs, TabPanel } from "../ui/tabs";
import { WarningsList } from "../ui/primitives";
import { WallPreviewSection } from "../ui/wallPreview";
import { ConnectionsSummary } from "../ui/connectionsSummary";
import { WallEstimateCardsExt } from "./mainSections";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import type { PanelScheduleCard } from "../ui/scheduleCards";

const TABS = [
  { id: "preview", label: "Preview" },
  { id: "schedule", label: "Schedule" },
  { id: "connections", label: "Connections" },
  { id: "warnings", label: "Warnings" },
];

export const WallWorkspaceTabs = ({ active, out, orient, layoutMode, walls, ScheduleComp, dimUnit, toDisp }: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  walls: Wall[]; ScheduleComp: typeof PanelScheduleCard; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const [tab, setTab] = useState("preview");
  return (
    <div className="mt-3">
      <Tabs tabs={TABS} activeId={tab} onChange={setTab} />
      <TabPanel id="preview" activeId={tab}>
        <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />
      </TabPanel>
      <TabPanel id="schedule" activeId={tab}>
        <WallEstimateCardsExt active={active} out={out} orient={orient} layoutMode={layoutMode} ScheduleComp={ScheduleComp} />
      </TabPanel>
      <TabPanel id="connections" activeId={tab}>
        <ConnectionsSummary active={active} walls={walls} />
      </TabPanel>
      <TabPanel id="warnings" activeId={tab}>
        <WarningsList warnings={!out.empty ? out.warnings : null} />
      </TabPanel>
    </div>
  );
};
