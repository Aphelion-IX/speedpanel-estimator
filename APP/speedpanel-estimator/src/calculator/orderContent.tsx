// =============================================================================
// Order content (shared -- src/calculator/)
// =============================================================================
// The Order tab's combined material summary -- factored out so the Estimate
// Results "Order" tab and the Order Review drawer render the exact same
// content from one place. Renders an Internal materials section (five
// buckets: Panels, Track and flashing, Connection materials, Fixing and
// sealant, Special/custom items) and an External materials section (four
// buckets -- no Corner/Shaft kits, no custom-length concept, see
// aggregateExternal.ts) side by side, each only when that side of the
// project has any walls -- same "only render if non-empty" pattern already
// used for the Corner/Shaft kit section. A pure Internal or pure External
// project (still the common case) renders identically to before the merge.
// Formerly internalCalculator/orderContent.tsx + externalCalculator/
// orderContent.tsx.
// =============================================================================
import { Box, Hammer } from "lucide-react";
import { cx } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { PACK, STOCK_LENGTHS, EXT_STOCK, EXT_PACK } from "../data";
import { aggregateProject, type AggPanelEntry, type AggCustomEntry, type ExtAggGroup } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import type { WallResult } from "../estimate/wall.types";
import type { EffectiveLayout } from "../useLayoutMode";
import { Card, CardGrid, Row } from "../ui/primitives";
import { StockGroupRow, PackNote, ScheduleRow, FixingSealantCard } from "../ui/scheduleCards";
import {
  TrackFlashingCardIntProj, ConnectionMaterialsCardInt,
  TrackFlashingCardExtProj, ConnectionMaterialsCardExt,
} from "./trackFlashingCards";

export const OrderContent = ({ layoutMode, aggProject, combinedEstimate, results }: {
  layoutMode: EffectiveLayout;
  aggProject: ReturnType<typeof aggregateProject>; combinedEstimate: CombinedEstimate; results: WallResult[];
}) => {
  const { internal, external } = aggProject;
  const hasInternal = results.some(r => r.wall.application === "internal");
  const hasExternal = results.some(r => r.wall.application === "external");

  return (
    <>
      {hasInternal && (
        <CardGrid layoutMode={layoutMode} minWidth={300}>
          <Card title="Panels (Internal)" icon={<Box size={14} />}>
            {internal.panels.length > 0 ? (
              <>
                {internal.panels.map((p: AggPanelEntry, i: number) => (
                  <StockGroupRow key={i}
                    stock={p.stock} ordered={p.ordered} pieces={p.pieces}
                    packs={p.packs} packSize={p.ps ?? PACK[p.type]} spare={p.spare}
                    stocks={STOCK_LENGTHS} isLast={i === internal.panels.length - 1}
                    typeLabel={`P${p.type}`}
                    packNote={(p.underPack || p.spare > 3) ? <PackNote type={p.type} spare={p.spare} /> : undefined}
                  />
                ))}
                <div className={cx.hr}><Row k="Wastage (order)" v={`${r1(internal.wastePct)}%`} dim /></div>
              </>
            ) : (
              <Row k="No panels yet" v="--" dim />
            )}
          </Card>

          <TrackFlashingCardIntProj agg={internal} />

          <ConnectionMaterialsCardInt
            agg={internal}
            connectionLM={combinedEstimate.connectionLM}
            connectionPieces={combinedEstimate.connectionPieces}
          />

          <Card title="Fixing and sealant -- Internal" icon={<Hammer size={14} />}>
            <Row k="10g 30mm SDS" v={`${internal.boxes30} box${plural(internal.boxes30)}`} hl />
            <Row k="QTY req" v={`${internal.fix30}`} dim />
            <Row k="10g 16mm SDS" v={`${internal.boxes16} box${plural(internal.boxes16)}`} hl />
            <Row k="QTY req" v={`${internal.fix16}`} dim />
            <Row k="Structure fixings (base track)" v="By others / engineer" dim />
            <div className={cx.hr}>
              <Row k="Hilti CP606 sealant" v={`${internal.sealantBoxes} box${plural(internal.sealantBoxes)} (${internal.sausages} sausages)`} hl />
              <Row k="total area / 4 m2/sausage" v={`${internal.totalArea} m2`} dim />
            </div>
            {internal.slabPassSausages > 0 && (
              <div className={cx.hr}>
                <Row k="Slab-pass sealant" v={`${internal.slabPassSealantBoxes} box${plural(internal.slabPassSealantBoxes)} (${internal.slabPassSausages} sausages)`} hl />
              </div>
            )}
            {internal.slabAnchors > 0 && (
              <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${internal.slabAnchors}`} dim />
            )}
            <p className={cx.footnote}>Est. fixings pooled - 1000/box.</p>
            {results.some(r => r.wall.application === "internal" && r.out.p2pEnhanced) && (
              <p className="pt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-300">One or more P78 vertical walls &gt; 5.0 m: enhanced panel-to-panel pattern applied.</p>
            )}
          </Card>

          <Card title="Special/custom items (Internal)" icon={<Box size={14} />}>
            {internal.customPanels.length > 0 ? (
              internal.customPanels.map((s: AggCustomEntry, i: number) => (
                <div key={i}>
                  <ScheduleRow mm={s.mm} ordered={s.ordered} qty={s.qty} packs={s.packs} packSize={s.packSize} stocks={STOCK_LENGTHS} isLast={i === internal.customPanels.length - 1} />
                  {(s.qty < s.packSize || s.spare > 3) && <PackNote type={s.type} spare={s.spare} />}
                </div>
              ))
            ) : (
              <Row k="No custom-length items" v="--" dim />
            )}
          </Card>
        </CardGrid>
      )}

      {hasExternal && (
        <CardGrid layoutMode={layoutMode} minWidth={300}>
          <Card title="Panels (External)" icon={<Box size={14} />}>
            {external.groups.length > 0 ? (
              external.groups.map((g: ExtAggGroup, i: number) => (
                <StockGroupRow key={i}
                  stock={g.stock} ordered={g.ordered} pieces={g.pieces}
                  packs={g.packs} packSize={EXT_PACK} spare={g.spare}
                  stocks={EXT_STOCK} isLast={i === external.groups.length - 1}
                />
              ))
            ) : (
              <Row k="No panels yet" v="--" dim />
            )}
          </Card>

          <TrackFlashingCardExtProj agg={external} />

          <ConnectionMaterialsCardExt
            connectionLM={hasInternal ? 0 : combinedEstimate.connectionLM}
            connectionPieces={hasInternal ? 0 : combinedEstimate.connectionPieces}
          />

          <FixingSealantCard title="Fixing and sealant -- External"
            boxes30={external.boxes30} fix30={external.fix30}
            boxes16={external.boxes16} fix16={external.fix16}
            sealantBoxes={external.sealantBoxes} sausages={external.sausages} area={external.totalArea}
            sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
        </CardGrid>
      )}
    </>
  );
};
