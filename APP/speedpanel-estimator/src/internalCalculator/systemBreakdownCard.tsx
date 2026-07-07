// =============================================================================
// System breakdown -- Internal
// =============================================================================
// One wall's own section of the combined estimate's "System Breakdown" --
// shows HOW that wall's estimate was built (name, orientation, dimensions,
// selected system, materials, C/J allowances, flashing, fixings,
// assumptions/warnings), reusing the exact same single-wall display
// components the "Selected wall estimate" view uses. Collapsible so a large
// project doesn't force scrolling past every wall to reach the Easy to Order
// summary; each wall keeps its own open/closed state.
// =============================================================================
import { useState } from "react";
import { ChevronDown, Frame, Box } from "lucide-react";
import { cx } from "../styleTokens";
import { PACK, STOCK_LENGTHS, INT_CONFIG } from "../data";
import type { Wall, ComputeOut } from "../estimate/wall.types";
import { computeCornerPair, computeShaftPair } from "../estimate/cornerShaftKits";
import { Card, Row, StatsRow, NotesList, WarningsList } from "../ui/primitives";
import { FixingSealantCard, PanelScheduleCard } from "../ui/scheduleCards";
import { TrackFlashingCardInt } from "./trackFlashingCards";
import { ShaftVerticalCard, CornerKitCard, ShaftJunctionCard, ShaftSlabCard } from "./kitCards";

// --- SystemBreakdownWallCard ---------------------------------------------------
// One wall's own section of the combined estimate's "System Breakdown" --
// shows HOW that wall's estimate was built (name, orientation, dimensions,
// selected system, materials, C/J allowances, flashing, fixings,
// assumptions/warnings), reusing the exact same single-wall display
// components the "Selected wall estimate" view uses. Collapsible so a large
// project doesn't force scrolling past every wall to reach the Easy to Order
// summary; each wall keeps its own open/closed state.
export const SystemBreakdownWallCard = ({ wall, out, walls, ScheduleComp }: {
  wall: Wall; out: ComputeOut; walls: Wall[];
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const cornerPartner = wall.wallSystem === "corner" && wall.cornerPartnerId != null
    ? walls.find(w => w.id === wall.cornerPartnerId) : undefined;
  const cornerKit = cornerPartner ? computeCornerPair(wall, cornerPartner, INT_CONFIG) : null;
  const shaftPartner = wall.wallSystem === "shaft" && wall.shaftPartnerId != null
    ? walls.find(w => w.id === wall.shaftPartnerId) : undefined;
  const shaftKit = shaftPartner ? computeShaftPair(wall, shaftPartner, INT_CONFIG) : null;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, Internal, P{wall.type}
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.chosen?.panels ?? out.result?.panels ?? "--"} panelType={`P${wall.type}`} />
              {out.chosen && !out.chosen.invalid && (
                <ScheduleComp title={`Panel schedule -- P${wall.type}`} icon={<Box size={14} />}
                  customSchedule={out.customSchedule}
                  groups={out.chosen.groups}
                  packSize={PACK[wall.type]} stocks={STOCK_LENGTHS}
                  wastePct={out.chosen.wastePct} orient={wall.orient} />
              )}
              <TrackFlashingCardInt out={out} headFlashActive={wall.headFlash} wall={wall} />
              {wall.wallSystem === "shaft" && <ShaftVerticalCard out={out} />}
              {cornerKit && <CornerKitCard kit={cornerKit} partnerName={cornerPartner?.name ?? "linked run"} />}
              {shaftKit && <ShaftJunctionCard kit={shaftKit} partnerName={shaftPartner?.name ?? "linked wall"} />}
              {wall.wallSystem === "shaft" && <ShaftSlabCard out={out} />}
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Hilti CP606 sealant" sealantRate={4}
                p2pNote={out.p2pNote} p2pEnhanced={out.p2pEnhanced} />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};
