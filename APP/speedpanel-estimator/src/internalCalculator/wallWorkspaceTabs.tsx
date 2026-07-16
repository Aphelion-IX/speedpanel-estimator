// =============================================================================
// Wall workspace tabs (phone)
// =============================================================================
// Phone-only per-item tab strip -- Preview / Schedule / Connections /
// Warnings -- wrapping EXISTING components, no new business logic. Config
// sections (WallsCard, Wall geometry minus preview, Tracks and flashing)
// stay above this in InternalCalculator.tsx's phone workspaceNode, unchanged;
// this only reorganizes the "what does this wall produce" content that used
// to be a WallPreviewSection + a standalone WarningsList + a separate
// "Wall estimate" accordion below the fold.
// =============================================================================
import { useState } from "react";
import { Tabs, TabPanel } from "../ui/tabs";
import { WarningsList } from "../ui/primitives";
import { WallPreviewSection } from "../ui/wallPreview";
import { ConnectionsSummary } from "../ui/connectionsSummary";
import { WallEstimateCards } from "./mainSections";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import type { PanelScheduleCard } from "../ui/scheduleCards";

const TABS = [
  { id: "preview", label: "Preview" },
  { id: "schedule", label: "Schedule" },
  { id: "connections", label: "Connections" },
  { id: "warnings", label: "Warnings" },
];

export const WallWorkspaceTabs = ({
  active, out, orient, layoutMode, walls, cornerPair, shaftPair, ScheduleComp, dimUnit, toDisp,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
  ScheduleComp: typeof PanelScheduleCard; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const [tab, setTab] = useState("preview");
  return (
    <div className="mt-3">
      <Tabs tabs={TABS} activeId={tab} onChange={setTab} />
      <TabPanel id="preview" activeId={tab}>
        <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />
      </TabPanel>
      <TabPanel id="schedule" activeId={tab}>
        <WallEstimateCards
          active={active} out={out} orient={orient} layoutMode={layoutMode}
          ScheduleComp={ScheduleComp} walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
        />
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
