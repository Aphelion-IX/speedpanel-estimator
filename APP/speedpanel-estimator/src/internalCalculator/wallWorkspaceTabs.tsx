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
//
// Uses its OWN tab-bar markup (not the shared ui/tabs.tsx Tabs/TabPanel, which
// stays as-is for EstimateResultsCard/project-mode and External) so this
// mockup-matched pill-tab restyle can't leak into those other tab strips.
// =============================================================================
import { useState } from "react";
import { NAVY } from "../styleTokens";
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
] as const;
type TabId = typeof TABS[number]["id"];

export const WallWorkspaceTabs = ({
  active, out, orient, layoutMode, walls, cornerPair, shaftPair, ScheduleComp, dimUnit, toDisp,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
  ScheduleComp: typeof PanelScheduleCard; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const [tab, setTab] = useState<TabId>("preview");
  return (
    <div className="mt-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={"shrink-0 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors " +
                (on ? "text-white" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400")}
              style={on ? { background: NAVY, borderColor: NAVY } : undefined}>
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "preview" && (
        <div className="mt-4">
          <WallPreviewSection active={active} walls={walls} out={out} dimUnit={dimUnit} toDisp={toDisp} />
        </div>
      )}
      {tab === "schedule" && (
        <div className="mt-4">
          <WallEstimateCards
            active={active} out={out} orient={orient} layoutMode={layoutMode}
            ScheduleComp={ScheduleComp} walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
          />
        </div>
      )}
      {tab === "connections" && (
        <div className="mt-4"><ConnectionsSummary active={active} walls={walls} /></div>
      )}
      {tab === "warnings" && (
        <div className="mt-4"><WarningsList warnings={!out.empty ? out.warnings : null} /></div>
      )}
    </div>
  );
};
