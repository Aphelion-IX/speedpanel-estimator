// =============================================================================
// Internal Calculator -- main-column sections
// =============================================================================
// WallEstimateCards is the shared per-wall detail (panel schedule, tracks/
// flashing, corner/shaft kit cards, fixings/sealant) used both by
// SingleWallEstimateSection's accordion (single-wall mode) and by
// estimateResultsCard.tsx's "Selected Wall" tab (project mode) -- one set of
// cards, two places that show them. System breakdown (every wall stacked)
// and the old combined "Easy to order" section were retired in favor of the
// Estimate Structure nav + Estimate Results tabs (see estimateResultsCard.tsx);
// their old homes here (SystemBreakdownSection, EasyToOrderSection) had no
// other callers and were removed rather than left as dead exports.
// =============================================================================
import { ChevronDown, Box } from "lucide-react";
import { cx } from "../styleTokens";
import { PACK, STOCK_LENGTHS } from "../data";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, NotesList } from "../ui/primitives";
import { PanelScheduleCard, FixingSealantCard } from "../ui/scheduleCards";
import { CornerKitCard, ShaftVerticalCard, ShaftSlabCard, ShaftJunctionCard } from "./kitCards";
import { TrackFlashingCardInt } from "./trackFlashingCards";

// --- WallEstimateCards -------------------------------------------------------
// One wall's own schedule/track/kit/fixing cards -- no StatsRow (redundant
// now that the Calculator Workspace's "Selected item metrics" strip already
// shows area/panels/type for whichever wall is active, in every mode).
export const WallEstimateCards = ({
  active, out, orient, layoutMode, ScheduleComp, walls, cornerPair, shaftPair,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  ScheduleComp: typeof PanelScheduleCard;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
}) => {
  if (out.empty || !out.chosen || out.chosen.invalid) return null;
  const chosen = out.chosen;
  return (
    <>
      <CardGrid layoutMode={layoutMode} minWidth={420}>
        <ScheduleComp title={`Panel schedule -- P${active.type}`} icon={<Box size={14} />}
          customSchedule={out.customSchedule}
          groups={chosen.groups}
          packSize={PACK[active.type]} stocks={STOCK_LENGTHS}
          wastePct={chosen.wastePct} orient={orient} />
        <TrackFlashingCardInt out={out} headFlashActive={active.headFlash} wall={active} />
        {active.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
        {cornerPair && (() => {
          const partner = walls.find(w => w.id === active.cornerPartnerId);
          return <CornerKitCard kit={cornerPair} partnerName={partner ? partner.name : "linked run"} />;
        })()}
        {shaftPair && (() => {
          const partner = walls.find(w => w.id === active.shaftPartnerId);
          return <ShaftJunctionCard kit={shaftPair} partnerName={partner ? partner.name : "linked wall"} />;
        })()}
        {active.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
        <FixingSealantCard title="Fixing and sealant quantities"
          boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
          boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
          sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
          sealantLabel="Hilti CP606 sealant" sealantRate={4}
          p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
      </CardGrid>
      {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
    </>
  );
};

// --- SingleWallEstimateSection ---------------------------------------------
// "Wall estimate -- {name}" accordion shown in single-wall mode: the
// accordion toggle wraps WallEstimateCards above.
export const SingleWallEstimateSection = ({
  active, out, orient, layoutMode, showWall, setShowWall, ScheduleComp, walls, cornerPair, shaftPair,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  showWall: boolean; setShowWall: (v: boolean) => void; ScheduleComp: typeof PanelScheduleCard;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
}) => {
  if (out.empty || !out.chosen || out.chosen.invalid) return null;
  return (
    <>
      <button onClick={() => setShowWall(!showWall)} className={cx.accordion}>
        <span>Wall estimate -- {active.name}</span>
        <ChevronDown size={15} className={`transition-transform ${showWall ? "rotate-180" : ""}`} />
      </button>
      {showWall && (
        <div className="mt-3">
          <WallEstimateCards
            active={active} out={out} orient={orient} layoutMode={layoutMode}
            ScheduleComp={ScheduleComp} walls={walls} cornerPair={cornerPair} shaftPair={shaftPair}
          />
        </div>
      )}
    </>
  );
};
