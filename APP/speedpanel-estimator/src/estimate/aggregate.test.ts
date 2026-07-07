import { describe, it, expect } from "vitest";
import { aggregate } from "./aggregate";
import { compute } from "./computeWall";
import { defaultWall } from "../wallStore";
import type { WallResult } from "./wall.types";

describe("aggregate (Internal)", () => {
  it("aggregates a single simple wall to match its own ComputeOut totals", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const out = compute(wall);
    const results: WallResult[] = [{ wall, out }];

    const agg = aggregate(results);
    expect(agg.totalArea).toBeCloseTo(out.area!, 2);
    expect(agg.fix30).toBe(out.fix30);
    expect(agg.fix16).toBe(out.fix16);
    expect(agg.totalPanels).toBe(out.chosen!.panels);
    expect(agg.panels.length).toBeGreaterThan(0);
  });

  it("returns a zeroed-out aggregate for an empty wall list", () => {
    const agg = aggregate([]);
    expect(agg.totalArea).toBe(0);
    expect(agg.totalPanels).toBe(0);
    expect(agg.panels).toEqual([]);
  });
});
