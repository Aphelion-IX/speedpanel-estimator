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
    // totalPanels is the ordered (pack-rounded) quantity, not the raw
    // required count -- matches out.chosen.orderedInPacks, not .panels.
    expect(agg.totalPanels).toBe(out.chosen!.orderedInPacks);
    expect(agg.panels.length).toBeGreaterThan(0);
  });

  it("returns a zeroed-out aggregate for an empty wall list", () => {
    const agg = aggregate([]);
    expect(agg.totalArea).toBe(0);
    expect(agg.totalPanels).toBe(0);
    expect(agg.panels).toEqual([]);
  });
});

// Corner/shaft kit materials are shared once per LINKED PAIR, so the seen-set
// must key on the pair rather than on whichever wall it was first reached
// from. A saved project can hold an ASYMMETRIC link -- duplicateWallById used
// to copy cornerPartnerId/shaftPartnerId onto the copy, leaving two walls both
// pointing at the same partner while that partner points back at only one.
// Without pair-keyed bookkeeping the same physical junction bills twice, and
// the over-count flows straight into the exported workbook and order pricing.
describe("aggregate (Internal) -- corner/shaft pair de-duplication", () => {
  const cornerResults = (walls: Parameters<typeof compute>[0][]): WallResult[] =>
    walls.map(wall => ({ wall, out: compute(wall) }));

  it("bills one corner kit when a third wall points at an already-paired partner", () => {
    const cornerA = { ...defaultWall(1, "horizontal"), wallSystem: "corner" as const, width: "3", height: "3", cornerPartnerId: 2 };
    const cornerB = { ...defaultWall(2, "horizontal"), wallSystem: "corner" as const, width: "3", height: "3", cornerPartnerId: 1 };
    const cornerACopy = { ...cornerA, id: 3, name: "Wall 1 copy" };

    const paired = aggregate(cornerResults([cornerA, cornerB]));
    const withCopy = aggregate(cornerResults([cornerA, cornerB, cornerACopy]));

    expect(paired.cornerPostLM).toBeGreaterThan(0);
    expect(withCopy.cornerPostLM).toBeCloseTo(paired.cornerPostLM, 6);
    expect(withCopy.cornerScrews).toBe(paired.cornerScrews);
  });

  it("bills one shaft junction when a third wall points at an already-paired partner", () => {
    const shaftA = { ...defaultWall(1, "horizontal"), wallSystem: "shaft" as const, width: "3", height: "9", floorHeight: "3", shaftPartnerId: 2 };
    const shaftB = { ...defaultWall(2, "horizontal"), wallSystem: "shaft" as const, width: "3", height: "9", floorHeight: "3", shaftPartnerId: 1 };
    const shaftACopy = { ...shaftA, id: 3, name: "Wall 1 copy" };

    const paired = aggregate(cornerResults([shaftA, shaftB]));
    const withCopy = aggregate(cornerResults([shaftA, shaftB, shaftACopy]));

    expect(paired.junctionLM).toBeGreaterThan(0);
    expect(withCopy.junctionLM).toBeCloseTo(paired.junctionLM, 6);
  });
});
