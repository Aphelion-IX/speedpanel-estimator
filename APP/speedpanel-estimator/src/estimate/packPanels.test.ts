import { describe, it, expect } from "vitest";
import { packPanels, buildOption } from "./packPanels";

describe("packPanels", () => {
  it("packs three 2.5m pieces into 3.0m/6.0m stock at minimum waste", () => {
    const raw = packPanels([2.5, 2.5, 2.5], null, [3.0, 6.0]);
    expect(raw.exceeds).toBeFalsy();
    expect(raw.tooShort).toBeFalsy();
    if (!raw.groups) throw new Error("expected a successful pack result");
    expect(raw.totalPanels).toBe(3);
    expect(raw.usedLM).toBeCloseTo(7.5, 5);
    // 3x 2.5m pieces, one per 3.0m panel, is the equal-lowest-waste option and
    // is preferred by the tie-break (first candidate wins on an exact tie).
    expect(raw.groups).toEqual([{ stock: 3.0, pieces: 3 }]);
    expect(raw.waste).toBeCloseTo(1.5, 5);
  });

  it("reports exceeds when the longest piece exceeds every stock length", () => {
    const raw = packPanels([7.0], null, [3.0, 6.0]);
    expect(raw.exceeds).toBe(true);
  });

  it("reports tooShort when a forced stock length can't fit the longest piece", () => {
    const raw = packPanels([4.0], 3.0, [3.0, 6.0]);
    expect(raw.tooShort).toBe(true);
    if (!raw.tooShort) throw new Error("expected tooShort");
    expect(raw.maxP).toBe(4.0);
  });
});

describe("buildOption", () => {
  it("layers pack-size/order info onto a successful pack result (P51, pack size 21)", () => {
    const raw = packPanels([2.5, 2.5, 2.5], null, [3.0, 6.0]);
    const result = buildOption(raw, 51);
    expect(result.invalid).toBeFalsy();
    expect(result.panels).toBe(3);
    expect(result.packs).toBe(1); // ceil(3 / 21)
    expect(result.groups[0].ps).toBe(21);
    expect(result.groups[0].ordered).toBe(21);
  });

  it("marks an exceeds result as invalid", () => {
    const raw = packPanels([7.0], null, [3.0, 6.0]);
    const result = buildOption(raw, 51);
    expect(result.invalid).toBe(true);
  });
});
