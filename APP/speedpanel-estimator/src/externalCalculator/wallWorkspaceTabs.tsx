// =============================================================================
// Wall workspace tabs (phone) -- External
// =============================================================================
// Mirrors internalCalculator/wallWorkspaceTabs.tsx -- see its header comment.
// External has no corner/shaft wallSystem concept, so its Schedule tab uses
// WallEstimateCardsExt (no cornerPair/shaftPair), and Connections only ever
// shows the generic junction-partner row (ConnectionsSummary already omits
// the corner/shaft rows unless active.wallSystem is set, which External
// walls never do).
//
// Uses its OWN tab-bar markup (not the shared ui/tabs.tsx Tabs/TabPanel,
// which stays as-is for EstimateResultsCard/project-mode) so this
// mockup-matched pill-tab restyle can't leak into those other tab strips --
// same reasoning Internal's version already applies.
// =============================================================================
import { useState } from "react";
import { NAVY } from "../styleTokens";
import { WallPreviewSection } from "../ui/wallPreview";
import { ConnectionsSummary } from "../ui/connectionsSummary";
import { WallEstimateCardsExt } from "./mainSections";
import { WarningsListPhone } from "./phoneSections";
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

export const WallWorkspaceTabs = ({ active, out, orient, layoutMode, walls, ScheduleComp, dimUnit, toDisp }: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  walls: Wall[]; ScheduleComp: typeof PanelScheduleCard; dimUnit: string; toDisp: (m: string) => string;
}) => {
  const [tab, setTab] = useState<TabId>("preview");
  return (
    // No own top margin -- nested flush as the last section inside
    // SheetCardPhone, right after Tracks (see ExternalCalculator.tsx).
    <div className="px-4 py-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map(t => {
          const on = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={"shrink-0 rounded-lg border px-3.5 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap transition-colors " +
                (on ? "text-white" : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300")}
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
          <WallEstimateCardsExt active={active} out={out} orient={orient} layoutMode={layoutMode} ScheduleComp={ScheduleComp} />
        </div>
      )}
      {tab === "connections" && (
        <div className="mt-4"><ConnectionsSummary active={active} walls={walls} /></div>
      )}
      {tab === "warnings" && (
        <div className="mt-4"><WarningsListPhone warnings={!out.empty ? out.warnings : null} /></div>
      )}
    </div>
  );
};
