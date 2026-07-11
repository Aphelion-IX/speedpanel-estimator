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

  it("accepts a per-system wasteThreshold override that changes which stock candidate wins", () => {
    // Two 2.0m pieces: packing each into its own 3.0m stock wastes 2.0m total
    // (33%, the first candidate tried, always accepted unconditionally); a
    // single 4.5m stock fits both pieces in one bin and wastes only 0.5m
    // (11%) -- but the algorithm only switches to that strictly-lower-waste
    // candidate when its own wastePct clears wasteThreshold.
    const lenient = packPanels([2.0, 2.0], null, [3.0, 4.5], false, 0.20);
    if (!lenient.groups) throw new Error("expected a successful pack result");
    expect(lenient.groups).toEqual([{ stock: 4.5, pieces: 1 }]);

    const strict = packPanels([2.0, 2.0], null, [3.0, 4.5], false, 0.05);
    if (!strict.groups) throw new Error("expected a successful pack result");
    expect(strict.groups).toEqual([{ stock: 3.0, pieces: 2 }]);
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

  it("accepts a per-system highWastePct override instead of the default 15%", () => {
    // A single 2.5m piece against a 21-panel pack size (P51) delivers a whole
    // pack for one piece, so order-level wastePct (offcut + pack spare, over
    // delivered length) lands around 96% -- a deliberately extreme case so
    // the threshold comparison itself, not the underlying pack math, is what
    // the two assertions below are pinned against.
    const raw = packPanels([2.5], null, [3.0, 6.0]);
    const result = buildOption(raw, 51);
    expect(result.wastePct).toBeGreaterThan(90);
    expect(result.wastePct).toBeLessThan(99);

    const strict = buildOption(raw, 51, 90);
    expect(strict.highWaste).toBe(true);
    const lenient = buildOption(raw, 51, 99);
    expect(lenient.highWaste).toBe(false);
  });
});
