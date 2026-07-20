import { describe, it, expect } from "vitest";
import { aggregateProject } from "./aggregateProject";
import { compute, computeExternal } from "./computeWall";
import { defaultWall } from "../wallStore";
import type { WallResult } from "./wall.types";

function wallResult(id: number, application: "internal" | "external"): WallResult {
  const wall = { ...defaultWall(id, "vertical", application), width: "3", height: "3" };
  const out = application === "internal" ? compute(wall) : computeExternal(wall);
  return { wall, out };
}

describe("aggregateProject", () => {
  it("routes each wall to the aggregate matching its own application, not flattened together", () => {
    const results = [wallResult(1, "internal"), wallResult(2, "external")];
    const { internal, external } = aggregateProject(results);

    // Internal's aggregate only reflects wall 1; External's only wall 2 --
    // neither should see the other side's wall.
    expect(internal.totalPanels).toBeGreaterThan(0);
    expect(internal.panels.length).toBeGreaterThan(0);
    expect(external.panels).toBeGreaterThan(0);
    expect(external.groups.length).toBeGreaterThan(0);
  });

  it("combines only the cross-cutting top-level numbers into `combined`", () => {
    const internalResult = wallResult(1, "internal");
    const externalResult = wallResult(2, "external");
    const results = [internalResult, externalResult];
    const { internal, external, combined } = aggregateProject(results);

    expect(combined.totalArea).toBeCloseTo(internal.totalArea + external.totalArea, 2);
    expect(combined.totalPanels).toBe(internal.totalPanels + external.panels);
  });

  it("counts warnings across both applications, independent of either sub-aggregate", () => {
    const warned: WallResult = { ...wallResult(1, "internal"), out: { ...wallResult(1, "internal").out, warnings: ["Span review required"] } };
    const clean = wallResult(2, "external");
    const { combined } = aggregateProject([warned, clean]);
    expect(combined.warningsCount).toBe(1);
  });

  it("returns zeroed-out aggregates for an all-empty wall list", () => {
    const { internal, external, combined } = aggregateProject([]);
    expect(internal.totalPanels).toBe(0);
    expect(external.panels).toBe(0);
    expect(combined.totalArea).toBe(0);
    expect(combined.totalPanels).toBe(0);
    expect(combined.warningsCount).toBe(0);
  });
});
