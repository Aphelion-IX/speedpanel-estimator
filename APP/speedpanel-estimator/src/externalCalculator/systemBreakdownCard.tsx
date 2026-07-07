// =============================================================================
// System breakdown -- External
// =============================================================================
// One wall's own section of the combined estimate's System Breakdown,
// reusing the same single-wall display components the External "Selected
// wall estimate" view uses (colour badge, TrackFlashingCardExt, External
// fixing/sealant rates).
// =============================================================================
import { useState } from "react";
import { ChevronDown, Frame, Box } from "lucide-react";
import { cx, NAVY, GOLD } from "../styleTokens";
import { EXT_STOCKED_COLOURS, EXT_PACK, EXT_STOCK } from "../data";
import type { Wall, ComputeOut, PanelGroup } from "../estimate/wall.types";
import { Card, Row, StatsRow, NotesList, WarningsList } from "../ui/primitives";
import { FixingSealantCard, PanelScheduleCard } from "../ui/scheduleCards";
import { TrackFlashingCardExt } from "./trackFlashingCards";

// --- SystemBreakdownWallCardExt -------------------------------------------------
// External-system counterpart to SystemBreakdownWallCard: one wall's own
// section of the combined estimate's System Breakdown, reusing the same
// single-wall display components the External "Selected wall estimate" view
// uses (colour badge, TrackFlashingCardExt, External fixing/sealant rates).
export const SystemBreakdownWallCardExt = ({ wall, out, ScheduleComp }: {
  wall: Wall; out: ComputeOut; ScheduleComp: typeof PanelScheduleCard;
}) => {
  const [open, setOpen] = useState(false);
  const colourEntry = wall.colour ? EXT_STOCKED_COLOURS.find(c => c.code === wall.colour) : null;
  const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : wall.colour;

  return (
    // cx.accordionInner (no baked-in mt-5, unlike cx.accordion) -- the wrapper's own
    // mt-3 provides the top gap instead, since this card is a CardGrid item and needs
    // consistent mt-3 spacing between wrapped rows, not the mt-5 "new section" gap.
    <div className="mt-3">
      <button onClick={() => setOpen(v => !v)} className={cx.accordionInner}>
        <span>
          {wall.name} -- {wall.orient === "vertical" ? "Vertical" : "Horizontal"}, External, P78
          {!out.empty ? ` -- ${out.area} m2` : ""}
        </span>
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3">
          {out.empty || !out.result ? (
            <Card title={wall.name} icon={<Frame size={14} />}>
              <Row k="Enter width and height to estimate this wall" v="--" dim />
            </Card>
          ) : (
            <>
              <StatsRow area={`${out.area} m2`} panels={out.result.panels} panelType="P78" />
              {wall.colour && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
                  <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Colour</span>
                  <span className="text-sm font-semibold" style={{ color: NAVY }}>{colourDisplay}</span>
                  {wall.colourType === "special" && <span className="ml-auto text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">Special order</span>}
                </div>
              )}
              <ScheduleComp title="Panel order schedule -- P78 coloured" icon={<Box size={14} />}
                customSchedule={out.customSchedule}
                groups={out.result.groups.map((g: PanelGroup) => ({ ...g, ps: EXT_PACK }))}
                packSize={EXT_PACK} stocks={EXT_STOCK} wastePct={out.result.wastePct} orient={wall.orient} />
              <TrackFlashingCardExt out={out} orient={wall.orient} headFlashActive={wall.headFlash} />
              <FixingSealantCard title="Fixing and sealant quantities"
                boxes30={out.boxes30 || 0} fix30={out.fix30 || 0}
                boxes16={out.boxes16 || 0} fix16={out.fix16 || 0}
                sealantBoxes={out.sealantBoxes || 0} sausages={out.sausages || 0} area={out.area || 0}
                sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings -- 1000/box." />
              <WarningsList warnings={out.warnings} />
              {out.notes && out.notes.length > 0 && <NotesList notes={out.notes} />}
            </>
          )}
        </div>
      )}
    </div>
  );
};
