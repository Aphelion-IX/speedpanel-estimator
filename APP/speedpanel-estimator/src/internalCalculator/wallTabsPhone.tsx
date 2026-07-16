// =============================================================================
// Wall tabs (phone) -- Schedule / Tracks / Links / Warnings
// =============================================================================
// Matches the SpeedHub mockup's 4-tab strip under the live-result card. No
// separate "Preview" tab (unlike ../internalCalculator/wallWorkspaceTabs.tsx,
// which this supersedes on phone) -- the mockup's canvas is always visible
// above the tabs, so a preview tab would be redundant. Wraps EXISTING
// components only: PanelScheduleCard (Schedule), TrackFlashingCardInt
// (Tracks), ConnectionsSummary (Links -- same read-only link summary
// wallWorkspaceTabs.tsx's "Connections" tab already used, just relabelled to
// match the mockup's wording), WarningsList (Warnings).
// =============================================================================
import { useState } from "react";
import { Box } from "lucide-react";
import { NAVY } from "../styleTokens";
import { PACK, STOCK_LENGTHS } from "../data";
import { WarningsList } from "../ui/primitives";
import { ConnectionsSummary } from "../ui/connectionsSummary";
import { TrackFlashingCardInt } from "./trackFlashingCards";
import type { PanelScheduleCard } from "../ui/scheduleCards";
import type { ComputeOut, Wall } from "../estimate/wall.types";

const TABS = [
  { id: "schedule", label: "Schedule" },
  { id: "tracks", label: "Tracks" },
  { id: "links", label: "Links" },
  { id: "warnings", label: "Warnings" },
] as const;
type TabId = typeof TABS[number]["id"];

export const WallTabsPhone = ({ active, out, orient, walls, ScheduleComp }: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; walls: Wall[];
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [tab, setTab] = useState<TabId>("schedule");
  const chosen = !out.empty ? out.chosen : undefined;

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

      {tab === "schedule" && (
        <div className="mt-4">
          {chosen && !chosen.invalid ? (
            <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
              customSchedule={out.customSchedule} groups={chosen.groups}
              packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
              wastePct={chosen.wastePct} orient={orient} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Enter dimensions to see the panel schedule.</p>
          )}
        </div>
      )}
      {tab === "tracks" && (
        <div className="mt-4">
          {!out.empty ? (
            <TrackFlashingCardInt out={out} headFlashActive={active.headFlash} wall={active} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Enter dimensions to see track requirements.</p>
          )}
        </div>
      )}
      {tab === "links" && (
        <div className="mt-4"><ConnectionsSummary active={active} walls={walls} /></div>
      )}
      {tab === "warnings" && (
        <div className="mt-4">
          {!out.empty && out.warnings.length > 0 ? (
            <WarningsList warnings={out.warnings} />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">No active warnings for this wall.</p>
          )}
        </div>
      )}
    </div>
  );
};
