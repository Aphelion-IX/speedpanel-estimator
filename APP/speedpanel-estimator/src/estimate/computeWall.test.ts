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

  it("packs a non-steel P78 vertical wall above the old 6.0 m stock max (site-joined, not exceeded)", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 78 as const, width: "3", height: "10" };
    const out = compute(wall);
    expect(out.empty).toBe(false);
    expect(out.chosen).toBeDefined();
    expect(out.chosen!.invalid).toBeFalsy();
    expect(out.chosen!.groups.length).toBeGreaterThan(0);
    expect(out.notes.some(n => n.includes("site-joined"))).toBe(true);
    expect(out.warnings).toEqual([]);
  });

  it("packs a non-steel P78 vertical wall at the new 14.0 m cap", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 78 as const, width: "3", height: "14" };
    const out = compute(wall);
    expect(out.empty).toBe(false);
    expect(out.chosen).toBeDefined();
    expect(out.chosen!.invalid).toBeFalsy();
    expect(out.chosen!.groups.length).toBeGreaterThan(0);
  });

  it("still rejects a non-steel P78 vertical wall above the 14.0 m cap", () => {
    const wall = { ...defaultWall(1, "vertical"), type: 78 as const, width: "3", height: "14.5" };
    const out = compute(wall);
    expect(out.empty).toBe(true);
    expect(out.warnings.some(w => w.includes("exceeds"))).toBe(true);
  });

  it("does not open a standalone short-stock group for a lone leftover course (regression: 4.2m over-order, Internal shares packPanels with External)", () => {
    // Same shape of bug as the External regression test below: a 4m-wide x
    // 7m-tall vertical P78 wall leaves one partially-filled leftover bin
    // (4.0m) that, pre-fix, was purchased as its own standalone pack of 14
    // (STOCK_LENGTHS has an exact 4.0m entry, so Internal lands on 4.0m
    // rather than External's 4.2m -- same underlying defect either way).
    const wall = { ...defaultWall(1, "vertical"), type: 78 as const, width: "4", height: "7" };
    const out = compute(wall);
    expect(out.empty).toBe(false);
    expect(out.chosen).toBeDefined();
    expect(out.chosen!.groups).toHaveLength(1);
    expect(out.chosen!.groups[0].stock).toBe(6.0);
    expect(out.chosen!.groups[0].pieces).toBe(19);
    expect(out.chosen!.groups.some(g => g.stock === 4.0)).toBe(false);
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

  it("packs an external vertical wall above the old 6.0 m stock max (site-joined, not exceeded)", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "10" };
    const out = computeExternal(wall);
    expect(out.empty).toBe(false);
    expect(out.result).toBeDefined();
    expect(out.result!.groups.length).toBeGreaterThan(0);
    expect(out.notes.some(n => n.includes("site-joined"))).toBe(true);
  });

  it("packs an external vertical wall at the new 14.0 m cap", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "14" };
    const out = computeExternal(wall);
    expect(out.empty).toBe(false);
    expect(out.result).toBeDefined();
    expect(out.result!.groups.length).toBeGreaterThan(0);
  });

  it("still rejects an external vertical wall above the 14.0 m cap", () => {
    const wall = { ...defaultWall(1, "vertical"), width: "3", height: "14.5" };
    const out = computeExternal(wall);
    expect(out.empty).toBe(true);
    expect(out.warnings.some(w => w.includes("exceeds"))).toBe(true);
  });

  it("does not open a standalone short-stock group for a lone leftover course (regression: 4.2m over-order)", () => {
    // 4m-wide x 7m-tall vertical P78 wall -- each of the 16 strips splits
    // into a 6.0m piece + a 1.0m leftover. The sixteen leftovers bin-pack
    // into 19 total 6.0m-equivalent bins with only one bin partially filled
    // (4.0m), which should now fold into the dominant 6.0m group instead of
    // spinning up its own 4.2m pack. See packPanels.test.ts for the
    // underlying unit-level coverage of this behaviour.
    const wall = { ...defaultWall(1, "vertical"), width: "4", height: "7" };
    const out = computeExternal(wall);
    expect(out.empty).toBe(false);
    expect(out.result).toBeDefined();
    expect(out.result!.groups).toHaveLength(1);
    expect(out.result!.groups[0].stock).toBe(6.0);
    expect(out.result!.groups[0].pieces).toBe(19);
    expect(out.result!.groups.some(g => g.stock === 4.2)).toBe(false);
  });
});
