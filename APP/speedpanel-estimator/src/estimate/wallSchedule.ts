// =============================================================================
// Custom schedule + external raw result
// =============================================================================
// computeWall's step 7 (per-length custom panel schedule for rake/gable
// profiles) and step 8 (external systems only: raw packed-panel result used
// by the project aggregate).
// =============================================================================
import { ceil, r1 } from "./mathUtils";
import { orderWastePct } from "./computeUtils";
import { computeCustomSchedule, computeGableSchedule } from "./packPanels";
import type { RawPack, RawPackSuccess } from "./packPanels";
import type { WallInput, Geometry, CustomScheduleEntry, ExtResult, PanelGroup } from "./wall.types";

/** Step 7: per-length custom panel schedule for non-standard profiles (rake/gable), collapsed to a forced length if set. */
export function buildCustomSchedule(inp: WallInput, geo: Geometry, pieces: number[], packSize: number, forced: number | null): CustomScheduleEntry[] | null {
  const { orient, profile } = inp;
  const { Hin, panelsAcross, stripHeights } = geo;
  let customSchedule: CustomScheduleEntry[] | null = null;

  if (orient === "vertical" && profile === "gable")
    customSchedule = computeGableSchedule(stripHeights.length ? stripHeights : Array(panelsAcross).fill(Hin), packSize);
  else if (orient === "vertical" && profile !== "standard")
    customSchedule = computeCustomSchedule(stripHeights.length ? stripHeights : Array(panelsAcross).fill(Hin), packSize);
  else if (orient === "horizontal" && profile !== "standard")
    customSchedule = computeCustomSchedule(pieces.slice(), packSize);

  // If a fixed stock length is selected, collapse customSchedule to that one length
  if (customSchedule && forced) {
    const totalQty = customSchedule.reduce((a, s) => a + s.qty, 0);
    const packs = Math.ceil(totalQty / packSize);
    customSchedule = [{ mm: Math.round(forced * 1000), qty: totalQty, packs, ordered: packs * packSize }];
  }

  return customSchedule;
}

/** Step 8 (external systems only): build the raw packed-panel result used by the project aggregate. */
export function buildExtResult(rawCut: RawPack, packSize: number): ExtResult | null {
  if (!Array.isArray((rawCut as RawPackSuccess).groups) || !(rawCut as RawPackSuccess).totalPanels) return null;
  const success = rawCut as RawPackSuccess;
  const groups: PanelGroup[] = success.groups.map(g => {
    const pks = ceil(g.pieces / packSize);
    const ord = pks * packSize;
    return { ...g, label: `${r1(g.stock)} m`, packs: pks, ordered: ord, spare: ord - g.pieces };
  });
  const spareLM = groups.reduce((a, g) => a + g.spare * g.stock, 0);
  const deliveredLM = groups.reduce((a, g) => a + g.ordered * g.stock, 0);
  return {
    groups,
    panels: groups.reduce((a, g) => a + g.pieces, 0),
    packs: groups.reduce((a, g) => a + g.packs, 0),
    ordered: groups.reduce((a, g) => a + g.ordered, 0),
    spare: groups.reduce((a, g) => a + g.spare, 0),
    wastePct: r1(orderWastePct(success.waste, spareLM, deliveredLM)),
    usedLM: success.usedLM, waste: success.waste + spareLM,
  };
}
