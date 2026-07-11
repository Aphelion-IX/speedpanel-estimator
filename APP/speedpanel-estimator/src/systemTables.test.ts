// =============================================================================
// Pins SYSTEM_TABLES_DEFAULTS to the exact literals that used to be inlined in
// data.ts's PANELS array (cornerPost/horizCtrack per type) and its
// SHAFT_TRACK_TABLE, before they moved into this file as admin-editable
// defaults. A future accidental edit to SYSTEM_TABLES_DEFAULTS that silently
// changes a real estimate's output should fail this test.
// =============================================================================
import { describe, it, expect } from "vitest";
import { SYSTEM_TABLES_DEFAULTS } from "./systemTables";

describe("SYSTEM_TABLES_DEFAULTS", () => {
  it("matches the original P51 cornerPost/horizCtrack literals", () => {
    expect(SYSTEM_TABLES_DEFAULTS.cornerPost["51"]).toEqual([
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 56 x 1.15" }, { maxH: 4.0, section: "55 x 57 x 1.50" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 57 x 1.50" }, { maxH: 4.0, section: "55 x 58 x 1.95" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
    ]);
    expect(SYSTEM_TABLES_DEFAULTS.horizCtrack["51"]).toEqual([
      { wMax: 3.0, hMax: 3.0, section: "55 x 56 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: null, section: "55 x 58 x 1.95", fix: 1, outsideTable: true },
    ]);
  });

  it("matches the original P64 cornerPost/horizCtrack literals", () => {
    expect(SYSTEM_TABLES_DEFAULTS.cornerPost["64"]).toEqual([
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 68 x 1.15" }, { maxH: 4.0, section: "55 x 69 x 1.50" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 69 x 1.50" }, { maxH: 4.0, section: "55 x 70 x 1.95" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
    ]);
    expect(SYSTEM_TABLES_DEFAULTS.horizCtrack["64"]).toEqual([
      { wMax: 3.0, hMax: 3.0, section: "55 x 68 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: null, section: "55 x 70 x 1.95", fix: 1, outsideTable: true },
    ]);
  });

  it("matches the original P78 cornerPost/horizCtrack literals", () => {
    expect(SYSTEM_TABLES_DEFAULTS.cornerPost["78"]).toEqual([
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "90 x 82 x 1.15" }, { maxH: 4.5, section: "90 x 83 x 1.50" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "90 x 83 x 1.50" }, { maxH: 4.5, section: "90 x 84 x 1.95" }] },
    ]);
    expect(SYSTEM_TABLES_DEFAULTS.horizCtrack["78"]).toEqual([
      { wMax: 3.0, hMax: 3.0, section: "90 x 82 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.5, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.5, section: "90 x 84 x 1.95", fix: 1 },
      { wMax: 3.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 2 },
      { wMax: 4.5, hMax: null, section: "90 x 84 x 1.95", fix: 2, outsideTable: true },
    ]);
  });

  it("matches the original SHAFT_TRACK_TABLE literal", () => {
    expect(SYSTEM_TABLES_DEFAULTS.shaftTrack).toEqual([
      { maxF: 3.0, section: "90 x 82 x 1.50", fixPerCourse: 1 },
      { maxF: 4.5, section: "90 x 84 x 1.95", fixPerCourse: 1 },
      { maxF: 6.0, section: "90 x 84 x 1.95", fixPerCourse: 2 },
    ]);
  });
});
