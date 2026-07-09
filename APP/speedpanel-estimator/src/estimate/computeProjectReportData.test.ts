import { describe, it, expect } from "vitest";
import { defaultWall } from "../wallStore";
import { compute } from "./computeWall";
import { computeProjectReportData } from "./computeProjectReportData";
import { buildInternalReportData } from "../export/buildInternalReportData";
import type { SavedProjectData } from "../pages/projects/projectTypes";

function baseData(overrides: Partial<SavedProjectData> = {}): SavedProjectData {
  return {
    v: 1, walls: [], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
    system: "int-vert", mode: "project", dimUnit: "m",
    ...overrides,
  };
}

describe("computeProjectReportData", () => {
  it("throws on a project with no walls", () => {
    expect(() => computeProjectReportData(baseData({ walls: [] }))).toThrow(/no walls/i);
  });

  it("reproduces buildInternalReportData's project-mode output for an Internal project", () => {
    const w1 = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), type: 51 as const, width: "4", height: "3" };
    const data = baseData({ walls: [w1, w2], activeId: 1, system: "int-vert", mode: "project" });

    const headless = computeProjectReportData(data);
    expect(headless.systemLabel).toBe("Internal calculator - Vertical");
    expect(headless.modeLabel).toBe("Project");
    expect(headless.walls).toHaveLength(2);
    expect(headless.panelGroups.length).toBeGreaterThan(0);
    expect(headless.panelGroups.every(g => g.panelType === 51)).toBe(true);
    expect(headless.totals.panels).toBeGreaterThan(0);
  });

  it("reproduces buildExternalReportData's project-mode output for an External project", () => {
    const w1 = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const data = baseData({ walls: [w1], activeId: 1, system: "ext-vert", mode: "project" });

    const headless = computeProjectReportData(data);
    expect(headless.systemLabel).toBe("External calculator - Vertical");
    expect(headless.modeLabel).toBe("Project");
    expect(headless.panelGroups.every(g => g.panelType === 78)).toBe(true);
  });

  it("handles single-wall mode (no crash resolving cornerPair/shaftPair for a plain standard wall)", () => {
    const w1 = { ...defaultWall(1, "vertical"), type: 78 as const, width: "3", height: "3" };
    const data = baseData({ walls: [w1], activeId: 1, system: "int-vert", mode: "single" });
    const headless = computeProjectReportData(data);
    expect(headless.modeLabel).toBe("Single wall");
    const out = compute(w1);
    const direct = buildInternalReportData({
      mode: "single", orient: "vertical", dimUnit: "m", toDisp: m => m,
      walls: [w1], results: [{ wall: w1, out }], warnById: {},
      active: w1, out, projChosenAgg: null,
      combinedEstimate: { connections: [], connectionLM: 0, connectionPieces: 0, connectionWarnings: [] },
      cornerPair: null, shaftPair: null,
    });
    expect(headless.totals.panels).toBe(direct.totals.panels);
  });
});
