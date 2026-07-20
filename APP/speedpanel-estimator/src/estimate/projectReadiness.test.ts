import { describe, it, expect } from "vitest";
import { determineProjectReadiness } from "./projectReadiness";
import { defaultWall } from "../wallStore";
import type { WallResult, ComputeOut } from "./computeOut.types";
import type { KitEntry } from "./synthesizeKits";

const emptyOut: ComputeOut = { empty: true, warnings: [], notes: [] };
const readyOut: ComputeOut = { empty: false, warnings: [], notes: [] };
const warningOut: ComputeOut = { empty: false, warnings: ["Custom panel length used on this wall."], notes: [] };

function result(wall: ReturnType<typeof defaultWall>, out: ComputeOut): WallResult {
  return { wall, out };
}

describe("determineProjectReadiness", () => {
  it("is waitingForInput when no wall has been touched", () => {
    const wall = defaultWall(1);
    const r = determineProjectReadiness([result(wall, emptyOut)], []);
    expect(r.state).toBe("waitingForInput");
    expect(r.blockers).toEqual([]);
  });

  it("is orderIncomplete when at least one wall is incomplete", () => {
    const complete = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const incomplete = { ...defaultWall(2), width: "3.2" }; // height missing
    const r = determineProjectReadiness([result(complete, readyOut), result(incomplete, emptyOut)], []);
    expect(r.state).toBe("orderIncomplete");
    expect(r.blockers.map(b => b.wallId)).toEqual([2]);
  });

  it("is readyWithWarnings when every wall is ready/calculable but a warning is unacknowledged", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const r = determineProjectReadiness([result(wall, warningOut)], []);
    expect(r.state).toBe("readyWithWarnings");
    expect(r.warnings.length).toBe(1);
  });

  it("is readyToReview once every warning has been acknowledged", () => {
    const wall = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const first = determineProjectReadiness([result(wall, warningOut)], []);
    const acknowledged = new Set(first.warnings.map(w => w.id));
    const second = determineProjectReadiness([result(wall, warningOut)], [], acknowledged);
    expect(second.state).toBe("readyToReview");
  });

  it("is readyToReview for a fully clean multi-wall project", () => {
    const a = { ...defaultWall(1), width: "3.2", height: "2.4" };
    const b = { ...defaultWall(2), width: "4.0", height: "2.7" };
    const r = determineProjectReadiness([result(a, readyOut), result(b, readyOut)], []);
    expect(r.state).toBe("readyToReview");
    expect(r.blockers).toEqual([]);
  });

  it("counts an unresolved kit warning toward readiness even when every wall is individually ready", () => {
    const a = { ...defaultWall(1, "horizontal"), width: "3", height: "3", wallSystem: "corner" as const, cornerPartnerId: 2 };
    const b = { ...defaultWall(2, "horizontal"), width: "3", height: "3.5", wallSystem: "corner" as const, cornerPartnerId: 1 };
    const kit: KitEntry = {
      id: "corner-1-2", kind: "corner", wallAId: 1, wallAName: a.name, wallBId: 2, wallBName: b.name,
      result: {
        section: "S1", fixPerCourse: 1, outsideTable: false,
        postLM: 3, postPieces: 1, postStock: 6,
        cornerScrews: 4, cornerScrewBoxes: 1,
        cornerSausages: 1, cornerSealantBoxes: 1,
        stripLM: 3, stripPieces: 1,
        H: 3, heightMismatch: true,
        warnings: ["Linked runs have different heights (3.0 m vs 3.5 m) -- confirm on site."],
        notes: [],
      },
    };
    const r = determineProjectReadiness([result(a, readyOut), result(b, readyOut)], [kit]);
    expect(r.state).toBe("readyWithWarnings");
    expect(r.warnings.some(w => w.title === "Linked wall height mismatch")).toBe(true);
  });
});
