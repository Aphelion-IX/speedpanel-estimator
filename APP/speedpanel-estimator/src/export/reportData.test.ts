import { describe, it, expect } from "vitest";
import { compute, computeExternal } from "../estimate/computeWall";
import { defaultWall } from "../wallStore";
import { aggregate, buildExtProjAgg } from "../estimate/aggregate";
import { calculateCombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { buildInternalReportData } from "./buildInternalReportData";
import { buildExternalReportData } from "./buildExternalReportData";
import { buildWorkbook } from "./buildWorkbook";

describe("buildInternalReportData", () => {
  it("aggregates every wall into the combined material list", () => {
    const w1 = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), type: 51 as const, width: "4", height: "3" };
    const results = [{ wall: w1, out: compute(w1) }, { wall: w2, out: compute(w2) }];
    const agg = aggregate(results);
    const combined = calculateCombinedEstimate([w1, w2]);
    const data = buildInternalReportData({
      orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [w1, w2], results, warnById: {},
      projChosenAgg: agg, combinedEstimate: combined,
    });
    expect(data.walls).toHaveLength(2);
    expect(data.totals.panels).toBe(agg.totalPanels);
    expect(data.totals.area).toBe(agg.totalArea);
    expect(data.panelGroups.length).toBeGreaterThan(0);
    // buildWorkbook should accept this without throwing (integration smoke test).
    expect(() => buildWorkbook(data)).not.toThrow();
  });
});

describe("buildExternalReportData", () => {
  it("aggregates every wall into the combined material list", () => {
    const w1 = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), width: "4", height: "3" };
    const results = [{ wall: w1, out: computeExternal(w1) }, { wall: w2, out: computeExternal(w2) }];
    const agg = buildExtProjAgg(results);
    const combined = calculateCombinedEstimate([w1, w2]);
    const data = buildExternalReportData({
      orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [w1, w2], results, warnById: {},
      projAgg: agg, combinedEstimate: combined,
    });
    expect(data.walls).toHaveLength(2);
    expect(data.totals.panels).toBe(agg.panels);
    expect(data.totals.area).toBe(agg.totalArea);
    expect(() => buildWorkbook(data)).not.toThrow();
  });

  it("consolidates leftover-course panels project-wide instead of ordering a standalone short-stock pack (regression: 4.2m over-order)", () => {
    // Reproduces the reported bug: two 4m x 7m vertical walls each leave a
    // lone partially-filled leftover bin that, pre-fix, was purchased as its
    // own 4.2m pack of 14 (12 spare) on top of the project's dominant 6.0m
    // group. Post-fix, both walls' leftovers fold into the 6.0m group at the
    // per-wall level (see computeWall.test.ts), so the project aggregate
    // should show a single 6.0m group and no 4.2m line item at all.
    const w1 = { ...defaultWall(1, "vertical"), width: "4", height: "7" };
    const w2 = { ...defaultWall(2, "vertical"), width: "4", height: "7" };
    const w3 = { ...defaultWall(3, "vertical"), width: "24", height: "6" };
    const results = [
      { wall: w1, out: computeExternal(w1) },
      { wall: w2, out: computeExternal(w2) },
      { wall: w3, out: computeExternal(w3) },
    ];
    const agg = buildExtProjAgg(results);
    expect(agg.groups).toHaveLength(1);
    expect(agg.groups[0]).toMatchObject({ stock: 6.0, pieces: 134, packs: 10, ordered: 140, spare: 6 });
    expect(agg.groups.some(g => g.stock === 4.2)).toBe(false);
  });
});
