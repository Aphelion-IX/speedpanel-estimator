// =============================================================================
// Track / flashing cards (shared -- src/calculator/)
// =============================================================================
// Single-wall and project-aggregate C/J-track (+ Z-flashing for External) +
// head flashing display. Internal and External each keep their own
// distinctly-named exports (TrackFlashingCardInt* vs TrackFlashingCardExt*)
// since the two systems' track catalogs are genuinely different (External
// has Z-flashing, Internal has Corner/Shaft kit materials split into
// ConnectionMaterialsCardInt) -- this file just gives both a shared home per
// the unified-estimator merge (docs/unified-estimator-merge-plan.md), not a
// shared implementation. Formerly internalCalculator/trackFlashingCards.tsx
// + externalCalculator/trackFlashingCards.tsx.
// =============================================================================
import { Frame } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import {
  JTRACK_STOCK, FLASH_STOCK, CTRACK_DIM, JTRACK_DIM, HORIZ_CTRACK_STOCK,
  EXT_CTRACK_STOCK, EXT_CTRACK_DIM, EXT_JTRACK_DIM, EXT_JTRACK_STOCK,
  EXT_ZFLASH_DIM, EXT_ZFLASH_STOCK,
} from "../data";
import type { ComputeOut, Wall } from "../estimate/wall.types";
import type { aggregate, CTrackAggEntry, buildExtProjAgg } from "../estimate/aggregate";
import { Card, Row } from "../ui/primitives";
import { LMLineItem, HeadFlashingCard } from "../ui/scheduleCards";

// =============================================================================
// Internal
// =============================================================================

// --- TrackFlashingCardInt -----------------------------------------------------
export const TrackFlashingCardInt = ({ out, headFlashActive, wall }: { out: ComputeOut; headFlashActive: boolean; wall?: Wall }) => {
  const jEdges: string[] = [];
  if (wall && out.jLM && out.jLM > 0) {
    if (wall.headFinish   === "J" && wall.edges && wall.edges.top)    jEdges.push("head");
    if (wall.bottomFinish === "J" && wall.edges && wall.edges.bottom) jEdges.push("base");
    if (wall.leftFinish   === "J" && wall.edges && wall.edges.left)   jEdges.push("left");
    if (wall.rightFinish  === "J" && wall.edges && wall.edges.right)  jEdges.push("right");
  }
  const jLabel = jEdges.length > 0 ? jEdges.join(" + ") : "selected edges";
  const isShaft = wall?.wallSystem === "shaft";
  return (
    <>
      <Card title={isShaft ? "Top and bottom track" : "Track and flashing"} icon={<Frame size={14} />}>
        {out.horizProfile && (
          <div className={`mb-3 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track section</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.horizProfile}</div>
            {out.horizFix && <div className={cx.infoBoxSub}>{out.horizFix} fixing{out.horizFix > 1 ? "s" : ""} each face</div>}
          </div>
        )}
        {out.cLM && out.cLM > 0 ? (
          <LMLineItem
            label={isShaft ? `Head + base track - ${out.ctrackDim}` : `C-track perimeter - ${out.ctrackDim}`}
            pieces={out.cPieces || 0} lm={out.cLM}
            stockLabel={`stocked @ ${r1(out.cStock || 0)} m`} />
        ) : (
          <Row k="C-track" v="No C-track edges selected" dim />
        )}
        {out.jLM && out.jLM > 0 && (
          <LMLineItem
            label={`J-track - ${jLabel} - ${out.jtrackDim}`}
            pieces={out.jPieces || 0} lm={out.jLM}
            stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
        )}
        {(!out.cLM || out.cLM === 0) && (!out.jLM || out.jLM === 0) && (
          <div className={cx.rowBorder}><Row k="No track yet" v="--" dim /></div>
        )}
        {wall && wall.wallSystem !== "corner" && wall.wallSystem !== "shaft" && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <div className={cx.cardHd}>Corner angles</div>
            <Row
              k={`Internal corners${wall.intCorners ? ` x ${wall.intCorners}` : ""}`}
              v={Number(wall.intCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.intCorners) > 0}
              dim={!Number(wall.intCorners)} />
            <Row
              k={`External corners${wall.extCorners ? ` x ${wall.extCorners}` : ""}`}
              v={Number(wall.extCorners) > 0 ? "TBC" : "--"}
              hl={Number(wall.extCorners) > 0}
              dim={!Number(wall.extCorners)} />
          </div>
        )}
      </Card>
      {headFlashActive && (
        <HeadFlashingCard dim={out.flashDim || ""} pieces={out.flashPieces || 0} lm={out.flashLM || 0} stock={FLASH_STOCK} />
      )}
    </>
  );
};

// --- TrackFlashingCardIntProj -------------------------------------------------
// Per-wall C/J-track + head flashing + shaft vertical track only -- Corner/
// Shaft kit materials and junction-link "extra track" live in
// ConnectionMaterialsCardInt below (split for the Order tab's five-bucket
// grouping: Tracks and flashings vs. Connection materials).
export const TrackFlashingCardIntProj = ({ agg }: {
  agg: ReturnType<typeof aggregate>;
}) => (
  <Card title="Track and flashing" icon={<Frame size={14} />}>
    {agg && agg.cTracks.map((c: CTrackAggEntry, i: number) => (
      <div key={i} className={cx.rowBorder}>
        {c.orient === "horizontal" && c.horizProfile && (
          <div className={`mb-1.5 ${cx.infoBox}`}>
            <div className={cx.infoBoxHd}>Selected C-track - P{c.type}</div>
            <div className={cx.infoBoxVal} style={{ color: NAVY }}>{c.horizProfile}</div>
            <div className={cx.infoBoxSub}>{c.horizFix} fixing{c.horizFix > 1 ? "s" : ""} each face - most conservative</div>
          </div>
        )}
        <LMLineItem
          label={c.orient === "horizontal" ? `C-track perimeter - P${c.type}` : `C-track vert P${c.type} - ${CTRACK_DIM[c.type]}`}
          pieces={c.pieces} lm={c.lm} stockLabel={`stocked @ ${r1(c.stock)} m`} bordered={false} />
      </div>
    ))}
    {agg && agg.jLM > 0 && (
      <LMLineItem
        label={`J-track - ${JTRACK_DIM[78]} - 1.15 mm BMT`}
        pieces={agg.jPieces} lm={agg.jLM} stockLabel={`stocked @ ${r1(JTRACK_STOCK[0])} m`} />
    )}
    {agg && agg.flashLM > 0 && (
      <LMLineItem
        label="Head track flashing 0.7 mm BMT x 130 mm GAL"
        pieces={agg.flashPieces} lm={agg.flashLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} />
    )}
    {agg && agg.vertTrackLM > 0 && (
      <LMLineItem
        label="Shaft vertical track (both edges, all shaft walls)"
        pieces={agg.vertTrackPieces} lm={agg.vertTrackLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
    )}
    {(!agg || (agg.cTracks.length === 0 && agg.jLM === 0 && agg.flashLM === 0 && agg.vertTrackLM === 0)) && <Row k="No track yet" v="--" dim />}
  </Card>
);

// --- ConnectionMaterialsCardInt ------------------------------------------------
// Corner/Shaft kit materials (posts, back-to-back junctions, protection
// strips) plus junction-link "extra track" -- everything a linked pair of
// walls needs that a single wall's own track/flashing doesn't cover.
export const ConnectionMaterialsCardInt = ({ agg, connectionLM = 0, connectionPieces = 0 }: {
  agg: ReturnType<typeof aggregate>; connectionLM?: number; connectionPieces?: number;
}) => (
  <Card title="Connection materials" icon={<Frame size={14} />}>
    {agg && agg.cornerPostLM > 0 && (
      <LMLineItem
        label="Corner posts (linked pairs)"
        pieces={agg.cornerPostPieces} lm={agg.cornerPostLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.junctionLM > 0 && (
      <LMLineItem
        label="Back-to-back junctions (linked pairs)"
        pieces={agg.junctionPieces} lm={agg.junctionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} />
    )}
    {agg && agg.stripLM > 0 && (
      <LMLineItem
        label="Protection strips (corner + shaft)"
        pieces={agg.stripPieces} lm={agg.stripLM} stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    )}
    {connectionPieces > 0 && (
      <LMLineItem
        label="Extra C/J track (combined wall junctions)"
        pieces={connectionPieces} lm={connectionLM} stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
    )}
    {(!agg || (agg.cornerPostLM === 0 && agg.junctionLM === 0 && agg.stripLM === 0)) && connectionPieces === 0 && <Row k="No connection materials yet" v="--" dim />}
  </Card>
);

// =============================================================================
// External
// =============================================================================

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
