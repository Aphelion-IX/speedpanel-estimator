import { describe, it, expect } from "vitest";
import { computeCornerPair, computeShaftPair } from "./cornerShaftKits";
import { defaultWall } from "../wallStore";
import { INT_CONFIG } from "../data";
import { ceil } from "./mathUtils";

describe("computeCornerPair", () => {
  it("sizes a corner post kit for two matching-height linked P51 runs", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run A" };
    const wallB = { ...defaultWall(2, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run B" };

    const kit = computeCornerPair(wallA, wallB, INT_CONFIG);
    expect(kit).not.toBeNull();
    if (!kit) return;
    expect(kit.H).toBe(3);
    expect(kit.heightMismatch).toBe(false);
    expect(kit.warnings).toEqual([]);
    expect(kit.postLM).toBeCloseTo(3, 5);
    expect(kit.section).toBeTruthy();
    // Corner screws: courses (ceil(H / panel width)) x fixPerCourse x 2 sides.
    const courses = ceil(3 / 0.25);
    expect(kit.cornerScrews).toBe(courses * kit.fixPerCourse * 2);
  });

  it("warns when the two linked runs have different heights", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run A" };
    const wallB = { ...defaultWall(2, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "2.5", name: "Run B" };

    const kit = computeCornerPair(wallA, wallB, INT_CONFIG);
    expect(kit).not.toBeNull();
    expect(kit!.heightMismatch).toBe(true);
    expect(kit!.warnings.length).toBe(1);
    // Sized to wallA's (the first run's) height, per the doc's convention.
    expect(kit!.H).toBe(3);
  });

  it("returns null when the first run has no height", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "", name: "Run A" };
    const wallB = { ...defaultWall(2, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run B" };
    expect(computeCornerPair(wallA, wallB, INT_CONFIG)).toBeNull();
  });
});

describe("computeShaftPair", () => {
  it("sizes a junction kit for two matching-height linked shaft walls", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 78 as const, wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Stack A" };
    const wallB = { ...defaultWall(2, "horizontal"), type: 78 as const, wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Stack B" };

    const kit = computeShaftPair(wallA, wallB, INT_CONFIG);
    expect(kit).not.toBeNull();
    if (!kit) return;
    expect(kit.H).toBe(9);
    expect(kit.floors).toBe(3); // ceil(9 / 3)
    expect(kit.heightMismatch).toBe(false);
    expect(kit.junctionLM).toBeCloseTo(2 * (9 + 0.1 * 3), 5);
  });
});
