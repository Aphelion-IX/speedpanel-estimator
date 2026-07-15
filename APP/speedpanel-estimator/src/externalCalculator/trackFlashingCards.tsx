// =============================================================================
// External track/flashing cards
// =============================================================================
// Single-wall and project-aggregate C/J-track + Z-flashing + head flashing
// display for the External calculator.
// =============================================================================
import { cx, NAVY } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import {
  EXT_CTRACK_STOCK, EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_JTRACK_STOCK,
  EXT_ZFLASH_DIM, EXT_ZFLASH_STOCK, FLASH_STOCK, HORIZ_CTRACK_STOCK,
} from "../data";
import type { ComputeOut } from "../estimate/wall.types";
import type { buildExtProjAgg } from "../estimate/aggregate";
import { Frame } from "lucide-react";
import { Card, Row } from "../ui/primitives";
import { LMLineItem, HeadFlashingCard } from "../ui/scheduleCards";

// --- TrackFlashingCardExt -----------------------------------------------------
export const TrackFlashingCardExt = ({ out, orient, headFlashActive }: { out: ComputeOut; orient: string; headFlashActive: boolean }) => (
  <>
    <Card title="Track and flashing" icon={<Frame size={14} />}>
      {orient === "horizontal" ? (
        <>
          {out.horizProfile && (
            <div className={`mb-2 ${cx.infoBox}`}>
              <div className={cx.infoBoxHd}>Selected C-track section</div>
              <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
              {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
            </div>
          )}
          {out.cLM && out.cLM > 0 ? (
            <LMLineItem
              label={`C-track perimeter - ${out.ctrackDim}`}
              pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`@ ${r1(EXT_CTRACK_STOCK[0])} m`} />
          ) : <Row k="C-track" v="No edges selected" dim />}
        </>
      ) : (
        out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label="C-track - Head + 2 sides"
            pieces={out.cPieces || 0} lm={out.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
        ) : <Row k="C-track" v="No head/side edges selected" dim />
      )}
      {out.jLM && out.jLM > 0 && (
        <LMLineItem
          label="J-track - Base"
          pieces={out.jPieces || 0} lm={out.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
      )}
      {out.zLM && out.zLM > 0 && (
        <LMLineItem
          label="Z-flashing (coloured)"
          pieces={out.zPieces || 0} lm={out.zLM} stockLabel={`${EXT_ZFLASH_DIM} - @ ${r1(EXT_ZFLASH_STOCK)} m`} />
      )}
    </Card>
    {headFlashActive && (
      <HeadFlashingCard
        dim="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={3.0} />
    )}
  </>
);

// --- TrackFlashingCardExtProj -------------------------------------------------
// Per-wall C/J/Z-track + head flashing only -- junction-link "extra track"
// lives in ConnectionMaterialsCardExt below (split for the Order tab's
// bucket grouping: Tracks and flashings vs. Connection materials).
export const TrackFlashingCardExtProj = ({ agg }: {
  agg: ReturnType<typeof buildExtProjAgg>;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg.cLM > 0 && (
      <LMLineItem
        label="C-track - Head + 2 sides"
        pieces={agg.cPieces} lm={agg.cLM} stockLabel={`${EXT_CTRACK_DIM} - @ ${r1(EXT_CTRACK_STOCK[0])} m`} />
    )}
    {agg.jLM > 0 && (
      <LMLineItem
        label="J-track - Base"
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`${EXT_JTRACK_DIM} - @ ${r1(EXT_JTRACK_STOCK[0])} m`} />
    )}
    {agg.zLM > 0 && (
      <LMLineItem
        label="Z-flashing (coloured)"
        pieces={agg.zPieces} lm={agg.zLM} stockLabel={`@ ${r1(EXT_ZFLASH_STOCK)} m`} />
    )}
    {agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`@ ${r1(FLASH_STOCK)} m`} />
    )}
    {agg.cLM === 0 && agg.jLM === 0 && agg.zLM === 0 && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- ConnectionMaterialsCardExt ------------------------------------------------
// External has no Corner/Shaft kit concept -- this only ever carries the
// junction-link "extra track" between differently-oriented linked walls.
export const ConnectionMaterialsCardExt = ({ connectionLM = 0, connectionPieces = 0 }: {
  connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Connection materials" icon={<Frame size={14} />}>
    {connectionPieces > 0 ? (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
    ) : (
      <Row k="No connection materials yet" v="--" dim />
    )}
  </Card>
);
