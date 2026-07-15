// =============================================================================
// External Calculator -- main-column sections
// =============================================================================
// The three sections ExternalCalculator's mainNode composes: the collapsible
// "Material quantities" (single-wall mode), the wall-by-wall "System
// breakdown", and the whole-project "Easy to order" summary (project mode).
// Split out purely to keep ExternalCalculator.tsx to its own state wiring +
// composition -- mirrors internalCalculator/mainSections.tsx.
// =============================================================================
import { Box, Layers } from "lucide-react";
import { NAVY, GOLD } from "../styleTokens";
import { buildExtProjAgg, type ExtAggGroup } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { EXT_STOCKED_COLOURS, EXT_STOCK, EXT_PACK } from "../data";
import type { ComputeOut, Wall, WallResult, PanelGroup } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { SectionLabel, CardGrid, StatsRow, NotesList, Card, Row } from "../ui/primitives";
import { PanelScheduleCard, FixingSealantCard, StockGroupRow } from "../ui/scheduleCards";
import { TrackFlashingCardExt, TrackFlashingCardExtProj } from "./trackFlashingCards";
import { SystemBreakdownWallCardExt } from "./systemBreakdownCard";

// --- SingleWallMaterialsContent -----------------------------------------------
// Single-wall mode's "Calculator Workspace" card content: stats, colour note,
// panel schedule, tracks/flashing, fixings/sealant. Used to be its own
// "Material quantities" accordion; now rendered plainly inside
// ExternalCalculator's always-visible WorkspaceCard instead (no open/close
// state of its own), with a placeholder shown until there's a valid estimate.
export const SingleWallMaterialsContent = ({
  active, out, orient, layoutMode, ScheduleComp,
}: {
  active: Wall; out: ComputeOut; orient: "vertical" | "horizontal"; layoutMode: EffectiveLayout;
  ScheduleComp: typeof PanelScheduleCard;
}) => {
  if (out.empty || !out.result) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        Enter wall dimensions in Wall geometry to see the estimate here.
      </p>
    );
  }
  const result = out.result;
  const colourEntry = active.colour ? EXT_STOCKED_COLOURS.find(c => c.code === active.colour) : null;
  const colourDisplay = colourEntry ? `${colourEntry.label} (${colourEntry.code})` : active.colour;
  return (
    <div>
      <StatsRow area={`${out.area} m2`} panels={result.panels} panelType="P78" />
      {active.colour && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5" style={{ borderColor: GOLD }}>
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
    </div>
  );
};

// --- SystemBreakdownSection --------------------------------------------------
// "System breakdown": shows HOW the combined estimate was built, wall by wall.
export const SystemBreakdownSection = ({ layoutMode, results, ScheduleComp }: {
  layoutMode: EffectiveLayout; results: WallResult[]; ScheduleComp: typeof PanelScheduleCard;
}) => (
  <>
    <SectionLabel icon={<Layers size={13} />}>System breakdown</SectionLabel>
    <CardGrid layoutMode={layoutMode} minWidth={420}>
      {results.map(({ wall: w, out: o }) => (
        <SystemBreakdownWallCardExt key={w.id} wall={w} out={o} ScheduleComp={ScheduleComp} />
      ))}
    </CardGrid>
  </>
);

// --- EasyToOrderSectionExt -----------------------------------------------------
// "Easy to order -- combined material summary": WHAT needs to be ordered,
// one combined material list for the whole project.
export const EasyToOrderSectionExt = ({ layoutMode, projAgg, combinedEstimate }: {
  layoutMode: EffectiveLayout; projAgg: ReturnType<typeof buildExtProjAgg>; combinedEstimate: CombinedEstimate;
}) => (
  <>
    <SectionLabel icon={<Box size={13} />}>Easy to order -- combined material summary</SectionLabel>
    <StatsRow area={`${projAgg.totalArea} m2`} panels={projAgg.panels} panelType="P78" />
    <CardGrid layoutMode={layoutMode} minWidth={300}>
      <Card title="Project order estimate" icon={<Box size={14} />}>
        {projAgg.groups.map((g: ExtAggGroup, i: number) => (
          <StockGroupRow key={i}
            stock={g.stock} ordered={g.ordered} pieces={g.pieces}
            packs={g.packs} packSize={EXT_PACK} spare={g.spare}
            stocks={EXT_STOCK} isLast={i === projAgg.groups.length - 1}
          />
        ))}
        {projAgg.groups.length === 0 && <Row k="No panels yet" v="--" dim />}
      </Card>
      <TrackFlashingCardExtProj agg={projAgg}
        connectionLM={combinedEstimate.connectionLM} connectionPieces={combinedEstimate.connectionPieces} />
      <FixingSealantCard title="Fixing and sealant -- whole project"
        boxes30={projAgg.boxes30} fix30={projAgg.fix30}
        boxes16={projAgg.boxes16} fix16={projAgg.fix16}
        sealantBoxes={projAgg.sealantBoxes} sausages={projAgg.sausages} area={projAgg.totalArea}
        sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
    </CardGrid>
  </>
);
