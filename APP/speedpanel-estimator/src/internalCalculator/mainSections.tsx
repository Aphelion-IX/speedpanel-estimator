// =============================================================================
// Internal Calculator -- main-column sections
// =============================================================================
// WallEstimateCards is the shared per-wall detail (panel schedule, tracks/
// flashing, corner/shaft kit cards, fixings/sealant) rendered by
// estimateResultsCard.tsx's "Selected Wall" tab. System breakdown (every wall stacked)
// and the old combined "Easy to order" section were retired in favor of the
// Estimate Structure nav + Estimate Results tabs (see estimateResultsCard.tsx);
// their old homes here (SystemBreakdownSection, EasyToOrderSection) had no
// other callers and were removed rather than left as dead exports.
// =============================================================================
import { Box } from "lucide-react";
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
