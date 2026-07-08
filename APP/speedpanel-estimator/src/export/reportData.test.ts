import { describe, it, expect } from "vitest";
import { compute, computeExternal } from "../estimate/computeWall";
import { defaultWall } from "../wallStore";
import { aggregate, buildExtProjAgg } from "../estimate/aggregate";
import { calculateCombinedEstimate } from "../estimate/calculateCombinedEstimate";
import { buildInternalReportData } from "./buildInternalReportData";
import { buildExternalReportData } from "./buildExternalReportData";
import { buildWorkbook } from "./buildWorkbook";

const noOpCombined = { connections: [], connectionLM: 0, connectionPieces: 0, connectionWarnings: [] };

describe("buildInternalReportData", () => {
  it("single-wall mode reports the active wall's own materials", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const out = compute(wall);
    const data = buildInternalReportData({
      mode: "single", orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [wall], results: [{ wall, out }], warnById: {},
      active: wall, out,
      projChosenAgg: null, combinedEstimate: noOpCombined,
      cornerPair: null, shaftPair: null,
    });
    expect(data.modeLabel).toBe("Single wall");
    expect(data.walls).toHaveLength(1);
    expect(data.walls[0].name).toBe("Wall 1");
    expect(data.panelGroups.length).toBeGreaterThan(0);
    expect(data.totals.panels).toBe(out.chosen!.panels);
    expect(data.fixings.fix30).toBe(out.fix30);
    expect(data.connections).toEqual([]);
  });

  it("project mode aggregates every wall into the combined material list", () => {
    const w1 = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), type: 51 as const, width: "4", height: "3" };
    const results = [{ wall: w1, out: compute(w1) }, { wall: w2, out: compute(w2) }];
    const agg = aggregate(results);
    const combined = calculateCombinedEstimate([w1, w2]);
    const data = buildInternalReportData({
      mode: "project", orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [w1, w2], results, warnById: {},
      active: w1, out: results[0].out,
      projChosenAgg: agg, combinedEstimate: combined,
      cornerPair: null, shaftPair: null,
    });
    expect(data.modeLabel).toBe("Project");
    expect(data.walls).toHaveLength(2);
    expect(data.totals.panels).toBe(agg.totalPanels);
    expect(data.totals.area).toBe(agg.totalArea);
    expect(data.panelGroups.length).toBeGreaterThan(0);
    // buildWorkbook should accept this without throwing (integration smoke test).
    expect(() => buildWorkbook(data)).not.toThrow();
  });
});

describe("buildExternalReportData", () => {
  it("single-wall mode reports the active wall's own materials", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const out = computeExternal(wall);
    const data = buildExternalReportData({
      extMode: "single", orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [wall], results: [{ wall, out }], warnById: {},
      active: wall, out,
      projAgg: buildExtProjAgg([{ wall, out }]), combinedEstimate: noOpCombined,
    });
    expect(data.modeLabel).toBe("Single wall");
    expect(data.walls).toHaveLength(1);
    expect(data.totals.panels).toBe(out.result!.panels);
    expect(data.panelGroups.length).toBeGreaterThan(0);
  });

  it("project mode aggregates every wall into the combined material list", () => {
    const w1 = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), width: "4", height: "3" };
    const results = [{ wall: w1, out: computeExternal(w1) }, { wall: w2, out: computeExternal(w2) }];
    const agg = buildExtProjAgg(results);
    const combined = calculateCombinedEstimate([w1, w2]);
    const data = buildExternalReportData({
      extMode: "project", orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [w1, w2], results, warnById: {},
      active: w1, out: results[0].out,
      projAgg: agg, combinedEstimate: combined,
    });
    expect(data.walls).toHaveLength(2);
    expect(data.totals.panels).toBe(agg.panels);
    expect(data.totals.area).toBe(agg.totalArea);
    expect(() => buildWorkbook(data)).not.toThrow();
  });
});
