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
});
