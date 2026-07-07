// =============================================================================
// Corner / Shaft kit cards
// =============================================================================
// Materials shared once per linked pair of Corner-wall or Shaft-wall runs,
// shown identically on both linked walls: the corner post kit, shaft
// vertical track, shaft slab passes, and shaft back-to-back junction kit.
// =============================================================================
import { AlertTriangle, Frame, Layers } from "lucide-react";
import { cx, NAVY } from "../styleTokens";
import { r1 } from "../estimate/mathUtils";
import { plural } from "../estimate/computeUtils";
import { FLASH_STOCK, HORIZ_CTRACK_STOCK } from "../data";
import type { ComputeOut } from "../estimate/wall.types";
import type { CornerPairResult, ShaftPairResult } from "../estimate/cornerShaftKits";
import { Card, Row } from "../ui/primitives";
import { LMLineItem } from "../ui/scheduleCards";

/** Corner wall kit -- the shared post, corner screws, corner sealant, and corner
 * protection strip for a linked pair of runs (see estimate_free_corner_wall.md
 * Part 2). Shown identically on both linked walls. */
export const CornerKitCard = ({ kit, partnerName }: { kit: CornerPairResult; partnerName: string }) => (
  <Card title="Corner kit" icon={<Frame size={14} />}>
    <p className={`mb-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500`}>Shared with {partnerName} -- calculated once per corner.</p>
    <LMLineItem
      label={`Corner post - ${kit.section}`}
      pieces={kit.postPieces} lm={kit.postLM}
      stockLabel={`stocked @ ${r1(kit.postStock)} m`} />
    <Row k={`Corner screws - ${kit.fixPerCourse}/course, both sides`} v={`${kit.cornerScrews} (${kit.cornerScrewBoxes} box${plural(kit.cornerScrewBoxes)})`} hl />
    <Row k="Corner sealant" v={`${kit.cornerSealantBoxes} box${plural(kit.cornerSealantBoxes)} (${kit.cornerSausages} sausages)`} hl />
    <LMLineItem
      label="Corner protection strip"
      pieces={kit.stripPieces} lm={kit.stripLM}
      stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);

/** Shaft wall's own vertical track / floors / slab-pass card (see estimate_shaft_wall.md). */
export const ShaftVerticalCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Vertical track" icon={<Frame size={14} />}>
    {out.vertTrackSection ? (
      <>
        <div className={`mb-3 ${cx.infoBox}`}>
          <div className={cx.infoBoxHd}>Selected vertical track section</div>
          <div className={cx.infoBoxVal} style={{ color: NAVY }}>{out.vertTrackSection}</div>
          <div className={cx.infoBoxSub}>{out.vertTrackFixPerCourse} fixing{(out.vertTrackFixPerCourse || 1) > 1 ? "s" : ""} each side, per course{out.floors ? ` - ${out.floors} floor${plural(out.floors)}` : ""}</div>
        </div>
        <LMLineItem
          label={`Both vertical edges - +100mm overlap per floor`}
          pieces={out.vertTrackPieces || 0} lm={out.vertTrackLM || 0}
          stockLabel={`stocked @ ${r1(HORIZ_CTRACK_STOCK)} m`} bordered={false} />
        {out.vertTrackOutsideTable && (
          <p className={`mt-2 ${cx.infoNote}`}>
            <span className="mt-0.5 shrink-0">i</span>
            Floor height exceeds the standard vertical track table -- confirmed conservatively. Contact Speedpanel.
          </p>
        )}
      </>
    ) : (
      <Row k="Vertical track" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall's slab-related quantities: informational anchor count, slab-pass sealant, protection strip. */
export const ShaftSlabCard = ({ out }: { out: ComputeOut }) => (
  <Card title="Slab passes" icon={<Layers size={14} />}>
    {out.floors ? (
      <>
        <Row k="Slab-edge anchors - by others, not a Speedpanel part" v={`~${out.slabAnchors || 0}`} dim />
        <Row k="Slab-pass sealant" v={`${out.slabPassSealantBoxes || 0} box${plural(out.slabPassSealantBoxes || 0)} (${out.slabPassSausages || 0} sausages)`} hl />
        <LMLineItem
          label="Protection strip - one length per slab pass + junction"
          pieces={out.stripPieces || 0} lm={out.stripLM || 0}
          stockLabel={`stocked @ ${r1(FLASH_STOCK)} m`} bordered={false} />
      </>
    ) : (
      <Row k="Slab passes" v="Enter floor height above" dim />
    )}
  </Card>
);

/** Shaft wall back-to-back junction kit, shared between a linked primary + secondary split wall. */
export const ShaftJunctionCard = ({ kit, partnerName }: { kit: ShaftPairResult; partnerName: string }) => (
  <Card title="Back-to-back junction" icon={<Frame size={14} />}>
    <p className="mb-2 text-xs leading-relaxed text-slate-400 dark:text-slate-500">Shared with {partnerName} -- calculated once per split.</p>
    <div className={`mb-3 ${cx.infoBox}`}>
      <div className={cx.infoBoxHd}>Selected junction track section</div>
      <div className={cx.infoBoxVal} style={{ color: NAVY }}>{kit.section}</div>
      <div className={cx.infoBoxSub}>{kit.fixPerCourse} fixing{kit.fixPerCourse > 1 ? "s" : ""} each side, per course - {kit.floors} floor{plural(kit.floors)}</div>
    </div>
    <LMLineItem
      label="Back-to-back C-track - +100mm overlap per floor"
      pieces={kit.junctionPieces} lm={kit.junctionLM}
      stockLabel={`stocked @ ${r1(kit.junctionStock)} m`} bordered={false} />
    <Row k="Junction screws" v={`${kit.junctionScrews} (${kit.junctionScrewBoxes} box${plural(kit.junctionScrewBoxes)})`} hl />
    {kit.notes.map((n, i) => (
      <p key={`n${i}`} className={`mt-2 ${cx.infoNote}`}>
        <span className="mt-0.5 shrink-0">i</span>
        {n}
      </p>
    ))}
    {kit.warnings.map((w, i) => (
      <p key={`w${i}`} className="mt-2 flex gap-1.5 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {w}
      </p>
    ))}
  </Card>
);
