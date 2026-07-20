// =============================================================================
// Calculator -- main-column sections (shared -- src/calculator/)
// =============================================================================
// WallEstimateCards is the shared per-wall detail (colour note for External,
// panel schedule, tracks/flashing, corner/shaft kit cards for Internal,
// fixings/sealant) rendered by estimateResultsCard.tsx's "Selected Wall" tab
// -- dispatches internally on `active.application`, mirroring the per-wall
// dispatch computeWall.ts/wallStore.ts's useWallResults already use. System
// breakdown (every wall stacked) and the old combined "Easy to order" section
// were retired in favor of the Estimate Structure nav + Estimate Results tabs
// (see estimateResultsCard.tsx); their old homes here (SystemBreakdownSection,
// EasyToOrderSection(Ext)) had no other callers and were removed rather than
// left as dead exports. Formerly internalCalculator/mainSections.tsx's
// WallEstimateCards + externalCalculator/mainSections.tsx's
// WallEstimateCardsExt.
// =============================================================================
import { Box } from "lucide-react";
import { NAVY, GOLD } from "../styleTokens";
import { PACK, STOCK_LENGTHS, EXT_STOCKED_COLOURS, EXT_STOCK, EXT_PACK } from "../data";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import type { ComputeOut, Wall, PanelGroup } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { CardGrid, NotesList } from "../ui/primitives";
import { PanelScheduleCard, FixingSealantCard } from "../ui/scheduleCards";
import { CornerKitCard, ShaftVerticalCard, ShaftSlabCard, ShaftJunctionCard } from "./kitCards";
import { TrackFlashingCardInt, TrackFlashingCardExt } from "./trackFlashingCards";

// --- WallEstimateCards -------------------------------------------------------
// One wall's own colour note (External)/kit cards (Internal) + schedule/
// track/fixing cards -- no StatsRow (redundant now that the Calculator
// Workspace's "Selected item metrics" strip already shows area/panels/type
// for whichever wall is active, in every mode).
export const WallEstimateCards = ({
  active, out, orient, layoutMode, ScheduleComp, walls, cornerPair, shaftPair,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  ScheduleComp: typeof PanelScheduleCard;
  walls: Wall[]; cornerPair: CornerPairResult | null; shaftPair: ShaftPairResult | null;
}) => {
  if (active.application === "external") {
    if (out.empty || !out.result) return null;
    const result = out.result;
    const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
    const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
    return (
      <>
        {active.colour && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-900/50 px-3 py-2.5" style={{ borderColor: GOLD }}>
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Colour</span>
            <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
            {active.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">Special order</span>}
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
  }

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
