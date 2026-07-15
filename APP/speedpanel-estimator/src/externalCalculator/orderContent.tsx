// =============================================================================
// Order content (External)
// =============================================================================
// The Order tab's combined material summary -- factored out so the Estimate
// Results "Order" tab and the Order Review drawer render the exact same
// content from one place. Four buckets, not Internal's five: External has
// no Corner/Shaft kit materials and no custom-length concept at all (see
// aggregateExternal.ts), so there's no "Special/custom items" bucket here --
// an always-empty card would be UI theater, not real content.
// =============================================================================
import { Box } from "lucide-react";
import { Card, CardGrid, Row } from "../ui/primitives";
import { StockGroupRow, FixingSealantCard } from "../ui/scheduleCards";
import { buildExtProjAgg, type ExtAggGroup } from "../estimate/aggregate";
import type { CombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { EXT_STOCK, EXT_PACK } from "../data";
import type { EffectiveLayout } from "../useLayoutMode";
import { TrackFlashingCardExtProj, ConnectionMaterialsCardExt } from "./trackFlashingCards";

export const OrderContent = ({ layoutMode, projAgg, combinedEstimate }: {
  layoutMode: EffectiveLayout;
  projAgg: ReturnType<typeof buildExtProjAgg>; combinedEstimate: CombinedEstimate;
}) => (
  <CardGrid layoutMode={layoutMode} minWidth={300}>
    <Card title="Panels" icon={<Box size={14} />}>
      {projAgg.groups.length > 0 ? (
        projAgg.groups.map((g: ExtAggGroup, i: number) => (
          <StockGroupRow key={i}
            stock={g.stock} ordered={g.ordered} pieces={g.pieces}
            packs={g.packs} packSize={EXT_PACK} spare={g.spare}
            stocks={EXT_STOCK} isLast={i === projAgg.groups.length - 1}
          />
        ))
      ) : (
        <Row k="No panels yet" v="--" dim />
      )}
    </Card>

    <TrackFlashingCardExtProj agg={projAgg} />

    <ConnectionMaterialsCardExt
      connectionLM={combinedEstimate.connectionLM}
      connectionPieces={combinedEstimate.connectionPieces}
    />

    <FixingSealantCard title="Fixing and sealant -- whole project"
      boxes30={projAgg.boxes30} fix30={projAgg.fix30}
      boxes16={projAgg.boxes16} fix16={projAgg.fix16}
      sealantBoxes={projAgg.sealantBoxes} sausages={projAgg.sausages} area={projAgg.totalArea}
      sealantLabel="Sikaflex 400 Fire PU" sealantRate={2} footnote="Est. fixings pooled - 1000/box." />
  </CardGrid>
);
