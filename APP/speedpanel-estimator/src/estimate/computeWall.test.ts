import { describe, it, expect } from "vitest";
import { compute, computeExternal } from "./computeWall";
import { defaultWall } from "../wallStore";

describe("compute (Internal)", () => {
  it("computes a simple 3m x 3m vertical P51 wall", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 51 as const, width: "3", height: "3" };
    const out = compute(wall);
    expect(out.empty).toBe(false);
    expect(out.area).toBeCloseTo(9, 2);
    expect(out.chosen).toBeDefined();
    expect(out.chosen!.invalid).toBeFalsy();
    expect(out.chosen!.groups.length).toBeGreaterThan(0);
    expect(out.chosen!.panels).toBeGreaterThan(0);
    expect(out.fix30).toBeGreaterThan(0);
    expect(out.warnings).toEqual([]);
  });

  it("computes a simple 3m x 3m horizontal Standard wall", () => {
    const wall = { ...defaultWall(1, "horizontal"), type: 51 as const, width: "3", height: "3" };
    const out = compute(wall);
    expect(out.empty).toBe(false);
    expect(out.cLM).toBeGreaterThan(0);
    expect(out.rows).toBeGreaterThan(0);
  });

  it("returns an empty result when width is missing", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "", height: "3" };
    const out = compute(wall);
    expect(out.empty).toBe(true);
  });

  it("returns an empty result when height is zero", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "0" };
    const out = compute(wall);
    expect(out.empty).toBe(true);
    expect(out.warnings).toContain("Wall height must be greater than zero.");
  });
});

describe("computeExternal", () => {
  it("computes a simple 3m x 3m vertical wall", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "3" };
    const out = computeExternal(wall);
    expect(out.empty).toBe(false);
    expect(out.area).toBeCloseTo(9, 2);
    expect(out.result).toBeDefined();
    expect(out.result!.groups.length).toBeGreaterThan(0);
  });
});
