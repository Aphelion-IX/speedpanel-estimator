// =============================================================================
// Order content
// =============================================================================
// The Order tab's five-bucket combined material summary (Panels, Tracks and
// flashings, Connection materials, Fixings and sealants, Special/custom
// items) -- factored out of estimateResultsCard.tsx so the Estimate Results
// "Order" tab and the Order Review drawer render the exact same content
// from one place, not two copies that could drift apart.
// =============================================================================
import { Box, Hammer } from "lucide-react";
import { cx } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { PACK, STOCK_LENGTHS } from "../data";
import { aggregate, type AggPanelEntry, type AggCustomEntry } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { Card, CardGrid, Row } from "../ui/primitives";
import { StockGroupRow, PackNote, ScheduleRow } from "../ui/scheduleCards";
import { TrackFlashingCardIntProj, ConnectionMaterialsCardInt } from "./trackFlashingCards";

export const OrderContent = ({ layoutMode, projChosenAgg, combinedEstimate, results }: {
  layoutMode: EffectiveLayout;
  projChosenAgg: ReturnType<typeof aggregate>; combinedEstimate: CombinedEstimate; results: WallResult[];
}) => (
  <CardGrid layoutMode={layoutMode} minWidth={300}>
    <Card title="Panels" icon={<Box size={14} />}>
      {projChosenAgg.panels.length > 0 ? (
        <>
          {projChosenAgg.panels.map((p: AggPanelEntry, i: number) => (
            <StockGroupRow key={i}
              stock={p.stock} ordered={p.ordered} pieces={p.pieces}
              packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
              stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.panels.length - 1}
              typeLabel={`P${p.type}`}
              packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
            />
          ))}
          <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(projChosenAgg.wastePct)}%`} dim /></div>
        </>
      ) : (
        <Row k="No panels yet" v="--" dim />
      )}
    </Card>

    <TrackFlashingCardIntProj agg={projChosenAgg} />

    <ConnectionMaterialsCardInt
      agg={projChosenAgg}
      connectionLM={combinedEstimate.connectionLM}
      connectionPieces={combinedEstimate.connectionPieces}
    />

    <Card title="Fixing and sealant -- whole project" icon={<Hammer size={14} />}>
      <Row k="10g 30mm SDS" v={`${projChosenAgg.boxes30} box${plural(projChosenAgg.boxes30)}`} hl />
      <Row k="QTY req" v={`${projChosenAgg.fix30}`} dim />
      <Row k="10g 16mm SDS" v={`${projChosenAgg.boxes16} box${plural(projChosenAgg.boxes16)}`} hl />
      <Row k="QTY req" v={`${projChosenAgg.fix16}`} dim />
      <Row k="Structure fixings (base track)" v="By others / engineer" dim />
      <div className={cx.hr}>
        <Row k="Hilti CP606 sealant" v={`${projChosenAgg.sealantBoxes} box${plural(projChosenAgg.sealantBoxes)} (${projChosenAgg.sausages} sausages)`} hl />
        <Row k="total area / 4 m2/sausage" v={`${projChosenAgg.totalArea} m2`} dim />
      </div>
      {projChosenAgg.slabPassSausages > 0 && (
        <div className={cx.hr}>
          <Row k="Slab-pass sealant" v={`${projChosenAgg.slabPassSealantBoxes} box${plural(projChosenAgg.slabPassSealantBoxes)} (${projChosenAgg.slabPassSausages} sausages)`} hl />
        </div>
      )}
      {projChosenAgg.slabAnchors > 0 && (
        <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${projChosenAgg.slabAnchors}`} dim />
      )}
      <p className={cx.footnote}>Est. fixings pooled - 1000/box.</p>
      {results.some(r => r.out.p2pEnhanced) && (
        <p className="pt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-300">One or more P78 vertical walls &gt; 5.0 m: enhanced panel-to-panel pattern applied.</p>
      )}
    </Card>

    <Card title="Special/custom items" icon={<Box size={14} />}>
      {projChosenAgg.customPanels.length > 0 ? (
        projChosenAgg.customPanels.map((s: AggCustomEntry, i: number) => (
          <div key={i}>
            <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === projChosenAgg.customPanels.length - 1} />
            {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
          </div>
        ))
      ) : (
        <Row k="No custom-length items" v="--" dim />
      )}
    </Card>
  </CardGrid>
);
