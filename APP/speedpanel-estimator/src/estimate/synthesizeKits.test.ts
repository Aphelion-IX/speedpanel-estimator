import { describe, it, expect } from "vitest";
import { synthesizeKits } from "./synthesizeKits";
import { defaultWall } from "../wallStore";
import { INT_CONFIG } from "../data";

describe("synthesizeKits", () => {
  it("produces exactly one corner kit entry for a linked pair", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run A", cornerPartnerId: 2 };
    const wallB = { ...defaultWall(2, "horizontal"), type: 51 as const, wallSystem: "corner" as const, width: "3", height: "3", name: "Run B", cornerPartnerId: 1 };

    const kits = synthesizeKits([wallA, wallB], INT_CONFIG);
    expect(kits.length).toBe(1);
    expect(kits[0].kind).toBe("corner");
    expect(kits[0].wallAId).toBe(1);
    expect(kits[0].wallAName).toBe("Run A");
    expect(kits[0].wallBId).toBe(2);
    expect(kits[0].wallBName).toBe("Run B");
    expect(kits[0].result).not.toBeNull();
  });

  it("produces exactly one shaft kit entry for a linked pair", () => {
    const wallA = { ...defaultWall(1, "horizontal"), type: 78 as const, wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Stack A", shaftPartnerId: 2 };
    const wallB = { ...defaultWall(2, "horizontal"), type: 78 as const, wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Stack B", shaftPartnerId: 1 };

    const kits = synthesizeKits([wallA, wallB], INT_CONFIG);
    expect(kits.length).toBe(1);
    expect(kits[0].kind).toBe("shaft");
    expect(kits[0].wallAId).toBe(1);
    expect(kits[0].wallBId).toBe(2);
  });

  it("produces no entries for an unlinked corner/shaft wall", () => {
    const wallA = { ...defaultWall(1, "horizontal"), wallSystem: "corner" as const, width: "3", height: "3", name: "Run A", cornerPartnerId: null };
    const wallB = { ...defaultWall(2, "horizontal"), wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Stack B", shaftPartnerId: null };

    expect(synthesizeKits([wallA, wallB], INT_CONFIG)).toEqual([]);
  });

  it("does not double-count a pair when walking from either wall's perspective, in a mixed set of standard/corner/shaft walls", () => {
    const standard = { ...defaultWall(1, "vertical"), name: "Standard 1" };
    const cornerA = { ...defaultWall(2, "horizontal"), wallSystem: "corner" as const, width: "3", height: "3", name: "Corner A", cornerPartnerId: 3 };
    const cornerB = { ...defaultWall(3, "horizontal"), wallSystem: "corner" as const, width: "3", height: "3", name: "Corner B", cornerPartnerId: 2 };
    const shaftA = { ...defaultWall(4, "horizontal"), wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Shaft A", shaftPartnerId: 5 };
    const shaftB = { ...defaultWall(5, "horizontal"), wallSystem: "shaft" as const, height: "9", floorHeight: "3", name: "Shaft B", shaftPartnerId: 4 };

    const kits = synthesizeKits([standard, cornerA, cornerB, shaftA, shaftB], INT_CONFIG);
    expect(kits.length).toBe(2);
    expect(kits.filter(k => k.kind === "corner").length).toBe(1);
    expect(kits.filter(k => k.kind === "shaft").length).toBe(1);
  });
});
