// =============================================================================
// Project-wide aggregation
// =============================================================================
// Combines every wall's ComputeOut in a project into one order (Internal:
// aggregate(); External: buildExtProjAgg()) -- including de-duplicating
// Corner/Shaft "kit" materials that are shared once per linked pair, not
// counted per-wall.
// =============================================================================
import { ceil, r1, r2 } from "./mathUtils";
import { boxesOf, orderWastePct } from "./computeUtils";
import { packInfo } from "./packPanels";
import { computeCornerPair, computeShaftPair } from "./cornerShaftKits";
import {
  PACK, JTRACK_STOCK, FLASH_STOCK, HORIZ_CTRACK_STOCK, SEALANT_PER_BOX, INT_CONFIG,
  EXT_PACK, EXT_SEALANT_PER_BOX, EXT_CTRACK_STOCK, EXT_JTRACK_STOCK, EXT_ZFLASH_STOCK,
} from "../data";
import type { SystemConfig } from "../data";
import type { WallResult, PanelGroup } from "./wall.types";

// --- Internal aggregate -------------------------------------------------------
export interface PanelMapEntry { type: number; stock: number; pieces: number; }
export interface CTrackMapEntry { type: number; orient: string; stock: number; lm: number; horizProfile: string | null; horizFix: number; }
export interface CTrackAggEntry extends CTrackMapEntry { pieces: number; } // post-aggregate: lm is rounded, pieces computed
export interface CustomMapEntry { type: number; mm: number; qty: number; }
// aggregate() output shapes (used in JSX render maps)
export interface AggPanelEntry extends PanelGroup { type: number; }
export interface AggCustomEntry { type: number; mm: number; qty: number; packs: number; ordered: number; spare: number; packSize: number; }
// buildExtProjAgg group output
export interface ExtAggGroup { stock: number; pieces: number; packs: number; ordered: number; spare: number; }

export function aggregate(results: WallResult[], cfg: SystemConfig = INT_CONFIG) {
  const pm: Record<string, PanelMapEntry> = {}, ct: Record<string, CTrackMapEntry> = {}, cm: Record<string, CustomMapEntry> = {};
  let f30 = 0, f16 = 0, flLM = 0, jLM = 0, offcut = 0, usedLM = 0, ta = 0, sus = 0;
  // Shaft wall per-wall vertical-track / slab-pass items (each wall's own
  // ComputeOut already has these computed -- just need summing here, same as
  // fix30/fix16/flashLM/etc. above).
  let vertLM = 0, slabAnchors = 0, slabSausages = 0, stripLM = 0;
  for (const { wall: w, out: o } of results) {
    if (o.empty || !o.chosen || o.chosen.invalid) continue;
    ta += parseFloat(String(o.area)) || 0;
    f30 += o.fix30 || 0; f16 += o.fix16 || 0; flLM += o.flashLM || 0; jLM += o.jLM || 0; sus += o.sausages || 0;
    vertLM += o.vertTrackLM || 0; slabAnchors += o.slabAnchors || 0; slabSausages += o.slabPassSausages || 0; stripLM += o.stripLM || 0;
    const ctKey = `${w.type}|${o.orient}`;
    if (!ct[ctKey]) ct[ctKey] = { type: w.type, orient: o.orient || "", stock: o.cStock || 0, lm: 0, horizProfile: null, horizFix: 1 };
    ct[ctKey].lm += o.cLM || 0;
    if (o.orient === "horizontal" && o.horizProfile) {
      const cur = ct[ctKey].horizProfile;
      if (!cur || (o.horizFix || 0) > ct[ctKey].horizFix || ((o.horizFix || 0) === ct[ctKey].horizFix && o.horizProfile > cur))
        { ct[ctKey].horizProfile = o.horizProfile; ct[ctKey].horizFix = o.horizFix ?? 1; }
    }
    if (o.customSchedule && o.customSchedule.length > 0) {
      for (const s of o.customSchedule) { const k = `${w.type}|${s.mm}`; cm[k] = cm[k] || { type: w.type, mm: s.mm, qty: 0 }; cm[k].qty += s.qty; }
    } else {
      // When a forced stock length is set, collapse all groups from this wall into
      // that single length for the aggregate -- the packer may split pieces across
      // multiple bins but the order should be placed entirely at the forced length.
      const forcedM = w.forcedStock ? parseFloat(w.forcedStock) : null;
      if (forcedM) {
        const totalPieces = o.chosen.groups.reduce((a, g) => a + g.pieces, 0);
        const k = `${w.type}|${forcedM}`;
        pm[k] = pm[k] || { type: w.type, stock: forcedM, pieces: 0 };
        pm[k].pieces += totalPieces;
      } else {
        for (const g of o.chosen.groups) { const k = `${w.type}|${g.stock}`; pm[k] = pm[k] || { type: w.type, stock: g.stock, pieces: 0 }; pm[k].pieces += g.pieces; }
      }
    }
    offcut += o.chosen.offcut || 0; usedLM += o.chosen.usedLM || 0;
  }

  // Corner-post and Shaft-junction kits are shared between exactly two linked
  // walls, so each pair must be counted once -- not once per wall in the pair.
  // Walk each wall once; only compute the pair's kit the first time either of
  // its two members is encountered, tracked via seenPairIds so the partner
  // isn't double-counted when its own turn comes up in the loop.
  let postScrews = 0, postScrewBoxes = 0, postLM = 0, cornerSausages2 = 0, cornerSealantBoxes2 = 0, postStripLM = 0;
  let junctionScrews2 = 0, junctionScrewBoxes2 = 0, junctionLM2 = 0;
  const seenCornerPairIds = new Set<number>(), seenShaftPairIds = new Set<number>();
  for (const { wall: w } of results) {
    if (w.wallSystem === "corner" && w.cornerPartnerId != null && !seenCornerPairIds.has(w.id) && !seenCornerPairIds.has(w.cornerPartnerId)) {
      const partner = results.find(r => r.wall.id === w.cornerPartnerId)?.wall;
      if (partner) {
        const kit = computeCornerPair(w, partner, cfg);
        if (kit) {
          postLM += kit.postLM; // raw required length -- pieces/ordered are derived below from the summed LM, same convention as vertTrackLM
          postScrews += kit.cornerScrews; postScrewBoxes += kit.cornerScrewBoxes;
          cornerSausages2 += kit.cornerSausages; cornerSealantBoxes2 += kit.cornerSealantBoxes;
          postStripLM += kit.stripLM;
        }
      }
      seenCornerPairIds.add(w.id);
    }
    if (w.wallSystem === "shaft" && w.shaftPartnerId != null && !seenShaftPairIds.has(w.id) && !seenShaftPairIds.has(w.shaftPartnerId)) {
      const partner = results.find(r => r.wall.id === w.shaftPartnerId)?.wall;
      if (partner) {
        const kit = computeShaftPair(w, partner, cfg);
        if (kit) {
          junctionLM2 += kit.junctionLM;
          junctionScrews2 += kit.junctionScrews; junctionScrewBoxes2 += kit.junctionScrewBoxes;
        }
      }
      seenShaftPairIds.add(w.id);
    }
  }

  const panels = Object.values(pm).map(p => ({ ...p, label: `${r1(p.stock)} m`, ...packInfo(p.pieces, p.type) })).sort((a, b) => a.type - b.type || a.stock - b.stock);
  const customPanels = Object.values(cm).sort((a, b) => a.type - b.type || a.mm - b.mm).map(({ type, mm, qty }) => {
    const packSize = PACK[type]; const packs = Math.ceil(qty / packSize); const ordered = packs * packSize;
    return { type, mm, qty, packs, ordered, spare: ordered - qty, packSize };
  });
  const cTracks = Object.values(ct).map(({ type, orient, stock, lm, horizProfile, horizFix }) => ({
    type, orient, lm: r2(lm), stock, pieces: lm > 0 ? ceil(lm / stock) : 0, horizProfile, horizFix
  })).filter(c => c.lm > 0).sort((a, b) => a.type - b.type || (a.orient > b.orient ? 1 : -1));
  let sp = 0, dl = 0;
  for (const p of panels) { sp += p.spare * p.stock; dl += p.ordered * p.stock; }
  for (const p of customPanels) { const stock = p.mm / 1000; sp += p.spare * stock; dl += p.ordered * stock; }
  const jLMr = r2(jLM), flLMr = r2(flLM);
  const vertLMr = r2(vertLM), stripLMr = r2(stripLM + postStripLM);
  const totalPostScrews = postScrews, totalJunctionScrews = junctionScrews2;
  return {
    panels, customPanels, cTracks, offcut: r2(offcut), spareLen: r2(sp), deliveredLen: r2(dl), usedLM,
    wastePct: orderWastePct(offcut, sp, dl),
    jLM: jLMr, jPieces: jLMr > 0 ? ceil(jLMr / JTRACK_STOCK[0]) : 0,
    flashLM: flLMr, flashPieces: flLMr > 0 ? ceil(flLMr / FLASH_STOCK) : 0,
    fix30: f30 + totalPostScrews + totalJunctionScrews, fix16: f16,
    boxes30: boxesOf(f30 + totalPostScrews + totalJunctionScrews), boxes16: boxesOf(f16),
    totalPanels: panels.reduce((a, p) => a + p.pieces, 0) + customPanels.reduce((a, s) => a + s.qty, 0),
    totalPacks: panels.reduce((a, p) => a + p.packs, 0) + customPanels.reduce((a, s) => a + s.packs, 0),
    totalArea: r2(ta), sausages: sus + cornerSausages2, sealantBoxes: (sus + cornerSausages2) > 0 ? Math.ceil((sus + cornerSausages2) / SEALANT_PER_BOX) : 0,
    // Shaft wall project totals (vertical track LM already includes per-wall
    // vertical tracks; junction LM/screws from linked pairs are separate since
    // they use a possibly-different section and aren't part of any one wall's
    // own vertTrackLM).
    vertTrackLM: vertLMr, vertTrackPieces: vertLMr > 0 ? ceil(vertLMr / HORIZ_CTRACK_STOCK) : 0,
    slabAnchors, slabPassSausages: slabSausages, slabPassSealantBoxes: slabSausages > 0 ? ceil(slabSausages / SEALANT_PER_BOX) : 0,
    stripLM: stripLMr, stripPieces: stripLMr > 0 ? ceil(stripLMr / FLASH_STOCK) : 0,
    junctionLM: r2(junctionLM2), junctionPieces: junctionLM2 > 0 ? ceil(junctionLM2 / HORIZ_CTRACK_STOCK) : 0,
    junctionScrews: junctionScrews2, junctionScrewBoxes: junctionScrewBoxes2,
    // Corner post project totals
    cornerPostLM: r2(postLM), cornerPostPieces: postLM > 0 ? ceil(postLM / HORIZ_CTRACK_STOCK) : 0,
    cornerScrews: postScrews, cornerScrewBoxes: postScrewBoxes,
  };
}

// --- External project aggregate -----------------------------------------------
export interface ExtPanelMapEntry { stock: number; pieces: number; }

export const buildExtProjAgg = (wallResults: WallResult[]) => {
  let totalArea = 0, fix30 = 0, fix16 = 0, sausages = 0, cLM = 0, jLM = 0, zLM = 0, flashLM = 0;
  const panelMap: Record<number, ExtPanelMapEntry> = {};
  for (const { wall: w, out: o } of wallResults) {
    if (o.empty || !o.result) continue;
    totalArea += parseFloat(String(o.area)) || 0;
    fix30 += o.fix30 || 0; fix16 += o.fix16 || 0; sausages += o.sausages || 0;
    cLM += o.cLM || 0; jLM += o.jLM || 0; zLM += o.zLM || 0; flashLM += o.flashLM || 0;
    const forcedM = w.forcedStock ? parseFloat(w.forcedStock) : null;
    if (forcedM) {
      const totalPieces = o.result.groups.reduce((a, g) => a + g.pieces, 0);
      panelMap[forcedM] = panelMap[forcedM] || { stock: forcedM, pieces: 0 };
      panelMap[forcedM].pieces += totalPieces;
    } else {
      for (const g of o.result.groups) { panelMap[g.stock] = panelMap[g.stock] || { stock: g.stock, pieces: 0 }; panelMap[g.stock].pieces += g.pieces; }
    }
  }
  const groups = Object.values(panelMap)
    .sort((a, b) => a.stock - b.stock)
    .map(g => {
      const pks = ceil(g.pieces / EXT_PACK);
      const ord = pks * EXT_PACK;
      return { ...g, packs: pks, ordered: ord, spare: ord - g.pieces };
    });
  const sealantBoxes = sausages > 0 ? ceil(sausages / EXT_SEALANT_PER_BOX) : 0;
  const cLMr = r2(cLM), jLMr = r2(jLM), zLMr = r2(zLM), flashLMr = r2(flashLM);
  return {
    groups, panels: groups.reduce((a, g) => a + g.pieces, 0), packs: groups.reduce((a, g) => a + g.packs, 0),
    totalArea: r2(totalArea), fix30, fix16, boxes30: boxesOf(fix30), boxes16: boxesOf(fix16),
    sausages, sealantBoxes, cLM: cLMr, jLM: jLMr, zLM: zLMr, flashLM: flashLMr,
    cPieces: cLMr > 0 ? ceil(cLMr / EXT_CTRACK_STOCK[0]) : 0,
    jPieces: jLMr > 0 ? ceil(jLMr / EXT_JTRACK_STOCK[0]) : 0,
    zPieces: zLMr > 0 ? ceil(zLMr / EXT_ZFLASH_STOCK) : 0,
    flashPieces: flashLMr > 0 ? ceil(flashLMr / 3.0) : 0,
  };
};
