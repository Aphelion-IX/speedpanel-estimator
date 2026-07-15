// =============================================================================
// External Calculator -- main-column sections
// =============================================================================
// WallEstimateCardsExt is the shared per-wall detail (colour note, panel
// schedule, tracks/flashing, fixings/sealant) used both by
// SingleWallMaterialsSection's accordion (single-wall mode) and by
// estimateResultsCard.tsx's "Selected Wall" tab (project mode). System
// breakdown (every wall stacked) and the old combined "Easy to order"
// section were retired in favor of the Estimate Structure nav + Estimate
// Results tabs (see estimateResultsCard.tsx); their old homes here
// (SystemBreakdownSection, EasyToOrderSectionExt) had no other callers and
// were removed rather than left as dead exports -- mirrors
// internalCalculator/mainSections.tsx.
// =============================================================================
import { ChevronDown, Box } from "lucide-react";
import { cx, NAVY, GOLD } from "../styleTokens";
import { EXT_STOCKED_COLOURS, EXT_STOCK, EXT_PACK } from "../data";
import type { ComputeOut, Wall, PanelGroup } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, NotesList } from "../ui/primitives";
import { PanelScheduleCard, FixingSealantCard } from "../ui/scheduleCards";
import { TrackFlashingCardExt } from "./trackFlashingCards";

// --- WallEstimateCardsExt -----------------------------------------------------
// One wall's own colour note + schedule/track/fixing cards -- no StatsRow
// (redundant now that the Calculator Workspace's "Selected item metrics"
// strip already shows area/panels for whichever wall is active, in every
// mode). Kept the colour note here since it's wall-specific, not a project-
// level stat.
export const WallEstimateCardsExt = ({ active, out, orient, layoutMode, ScheduleComp }: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  if (out.empty || !out.result) return null;
  const result = out.result;
  const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
  const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
  return (
    <>
      {active.colour && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Colour</span>
          <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
          {active.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Special order</span>}
        </div>
      )}
      <CardGrid layoutMode={layoutMode} minWidth={380}>
        <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
          customSchedule={out.customSchedule}
          groups={result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
          packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={result.wastePct} orient={orient} />
        <TrackFlashingCardExt out={out} orient={orient} headFlashActive={active.headFlash} />
        <FixingSealantCard title="Fixing and sealant quantities"
          boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
          boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
          sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
          sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
      </CardGrid>
      {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
    </>
  );
};

// --- SingleWallMaterialsSection -----------------------------------------------
// "Material quantities" accordion shown in single-wall mode: the accordion
// toggle wraps WallEstimateCardsExt above.
export const SingleWallMaterialsSection = ({
  active, out, orient, layoutMode, showTakeoff, setShowTakeoff, ScheduleComp,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  showTakeoff: boolean; setShowTakeoff: (v: boolean) => void; ScheduleComp: typeof PanelScheduleCard;
}) => {
  if (out.empty || !out.result) return null;
  return (
    <>
      <button onClick={() => setShowTakeoff(!showTakeoff)} className={cx.accordion}>
        <span>Material quantities</span>
        <ChevronDown size={15} className={`transition-transform ${showTakeoff ? "rotate-180" : ""}`} />
      </button>
      {showTakeoff && (
        <div className="mt-3">
          <WallEstimateCardsExt active={active} out={out} orient={orient} layoutMode={layoutMode} ScheduleComp={ScheduleComp} />
        </div>
      )}
    </>
  );
};
