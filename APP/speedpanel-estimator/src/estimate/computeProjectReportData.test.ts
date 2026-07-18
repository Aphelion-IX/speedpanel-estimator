import { describe, it, expect } from "vitest";
import { defaultWall } from "../wallStore";
import { computeProjectReportData } from "./computeProjectReportData";
import type { SavedProjectData } from "../pages/projects/projectTypes";

function baseData(overrides: Partial<SavedProjectData> = {}): SavedProjectData {
  return {
    v: 1, walls: [], activeId: 1, nextId: 2,
    projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
    system: "int-vert", dimUnit: "m",
    ...overrides,
  };
}

describe("computeProjectReportData", () => {
  it("throws on a project with no walls", () => {
    expect(() => computeProjectReportData(baseData({ walls: [] }))).toThrow(/no walls/i);
  });

  it("reproduces buildInternalReportData's output for an Internal project", () => {
    const w1 = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const w2 = { ...defaultWall(2, "vertical"), type: 51 as const, width: "4", height: "3" };
    const data = baseData({ walls: [w1, w2], activeId: 1, system: "int-vert" });

    const headless = computeProjectReportData(data);
    expect(headless.systemLabel).toBe("Internal calculator - Vertical");
    expect(headless.walls).toHaveLength(2);
    expect(headless.panelGroups.length).toBeGreaterThan(0);
    expect(headless.panelGroups.every(g => g.panelType === 51)).toBe(true);
    expect(headless.totals.panels).toBeGreaterThan(0);
  });

  it("reproduces buildExternalReportData's output for an External project", () => {
    const w1 = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const data = baseData({ walls: [w1], activeId: 1, system: "ext-vert" });

    const headless = computeProjectReportData(data);
    expect(headless.systemLabel).toBe("External calculator - Vertical");
    expect(headless.panelGroups.every(g => g.panelType === 78)).toBe(true);
  });
});
