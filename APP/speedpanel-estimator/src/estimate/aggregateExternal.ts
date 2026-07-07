// =============================================================================
// Project-wide aggregation -- External
// =============================================================================
// Combines every wall's ComputeOut in an External project into one order.
// See ./aggregateInternal.ts for the Internal counterpart (aggregate),
// which shares almost no code with this beyond a couple of math/data helpers.
// =============================================================================
import { ceil, r2 } from "./mathUtils";
import { boxesOf } from "./computeUtils";
import {
  EXT_PACK, EXT_SEALANT_PER_BOX, EXT_CTRACK_STOCK, EXT_JTRACK_STOCK, EXT_ZFLASH_STOCK,
} from "../data";
import type { WallResult } from "./wall.types";

export interface ExtPanelMapEntry { stock: number; pieces: number; }
// buildExtProjAgg group output
export interface ExtAggGroup { stock: number; pieces: number; packs: number; ordered: number; spare: number; }

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
