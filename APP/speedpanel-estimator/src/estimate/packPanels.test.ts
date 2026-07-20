import { describe, it, expect } from "vitest";
import { packPanels, buildOption, consolidateMinorityGroups } from "./packPanels";

const EXT_STOCK = [3.0, 3.6, 4.2, 4.5, 5.0, 6.0];

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

  it("folds a lone leftover bin into the dominant stock length instead of opening a new pack (regression: 4.2m over-order)", () => {
    // Reproduces the reported scenario: a 4m-wide x 7m-tall vertical wall
    // (16 strips) splits each strip into a 6.0m piece + a 1.0m leftover.
    // The sixteen 1.0m offcuts bin-pack into two full 6.0m-equivalent bins
    // plus one bin filled to only 4.0m. Without packSize-aware consolidation
    // that lone bin gets reassigned to a standalone 4.2m stock group, forcing
    // a whole extra pack of 14 four-point-two-metre panels for one panel's
    // worth of need. With packSize=14 supplied, it should fold back into the
    // 6.0m group instead, since the wall's own 6.0m group already has slack.
    const pieces = [...Array(16).fill(6.0), ...Array(16).fill(1.0)];
    const raw = packPanels(pieces, null, EXT_STOCK, false, 0.20, 14);
    if (!raw.groups) throw new Error("expected a successful pack result");
    expect(raw.groups).toEqual([{ stock: 6.0, pieces: 19 }]);
  });

  it("preserves the pre-fix per-bin behaviour when packSize is omitted (default is a no-op)", () => {
    // Same piece list as above, called without packSize -- the default of 1
    // means consolidateMinorityGroups can never find a merge cheaper than
    // staying separate, so the old standalone 4.2m group is still produced.
    // This pins the backward-compatibility guarantee for any caller that
    // doesn't pass packSize.
    const pieces = [...Array(16).fill(6.0), ...Array(16).fill(1.0)];
    const raw = packPanels(pieces, null, EXT_STOCK, false, 0.20);
    if (!raw.groups) throw new Error("expected a successful pack result");
    expect(raw.groups).toEqual([
      { stock: 4.2, pieces: 1 },
      { stock: 6.0, pieces: 18 },
    ]);
  });
});

describe("consolidateMinorityGroups", () => {
  it("merges a minority group into the dominant length when it fits inside existing pack-rounding slack", () => {
    // Dominant group of 18 @ 6.0m already needs ceil(18/14)=2 packs (28
    // ordered); adding 1 more panel still only needs 2 packs, so folding the
    // lone 4.2m panel in costs zero extra length, versus 14*4.2=58.8m to buy
    // it as its own pack.
    const gm = { 6.0: 18, 4.2: 1 };
    expect(consolidateMinorityGroups(gm, 6.0, 14)).toEqual({ 6.0: 19 });
  });

  it("keeps a minority group standalone when merging it would push the dominant group into an extra pack", () => {
    // Dominant group of 7 @ 6.0m needs ceil(7/4)=2 packs (8 ordered) already;
    // folding in 3 more (10 total) needs ceil(10/4)=3 packs (12 ordered), an
    // extra pack's worth of 6.0m (24m) for the merge, versus buying the 3
    // panels as their own pack of 4.5m stock: ceil(3/4)*4.5 = 18m. Standalone
    // is cheaper here, so the minority group should NOT be merged.
    const gm = { 6.0: 7, 4.5: 3 };
    expect(consolidateMinorityGroups(gm, 6.0, 4)).toEqual({ 6.0: 7, 4.5: 3 });
  });

  it("is a no-op with packSize=1 (every merge would cost strictly more)", () => {
    const gm = { 6.0: 18, 4.2: 1 };
    expect(consolidateMinorityGroups(gm, 6.0, 1)).toEqual({ 6.0: 18, 4.2: 1 });
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
