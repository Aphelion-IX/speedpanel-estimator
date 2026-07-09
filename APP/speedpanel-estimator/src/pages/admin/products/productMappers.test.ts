import { describe, it, expect } from "vitest";
import {
  fromPanelRow, toPanelRow, fromTrackRow, toTrackRow, fromFixingRow, toFixingRow,
  fromSealantRow, toSealantRow, fromColourRow, toColourRow, PanelRowSchema,
} from "./productMappers";

const rowBase = { id: "id-1", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-02T00:00:00.000Z" };

describe("productMappers", () => {
  it("round-trips a panel row, including its nested span/corner-post/horiz-ctrack jsonb", () => {
    const row = {
      ...rowBase, notes: "a note",
      type: 78, label: "P78", depth: "78 mm", frl: "-/120/120", pack: 14,
      ctrack_stock: 6, ctrack_dim: "55 x 82 x 55", jtrack_dim: "55 x 82 x 90",
      max_h_vert: 6, max_h_horiz: 6,
      span_vert: { maxW: "Unlimited", maxH: "6.0 m" },
      span_horiz: [{ maxW: "3.0 m", maxH: "3.0 m", cTrack: "90 x 82 x 1.15", fix: "1/face" }],
      corner_post: [{ maxW: 3, rows: [{ maxH: 3, section: "90 x 82 x 1.15", fixPerCourse: 1 as const }] }],
      // A null hMax is real, current production data, not a hypothetical --
      // data.ts's own outsideTable/no-ceiling row uses hMax: Infinity, which
      // JSON can't represent (JSON.stringify silently turns it into null),
      // so that's what's actually stored/read back from Supabase.
      horiz_ctrack: [
        { wMax: 3, hMax: 3, section: "90 x 82 x 1.15", fix: 1 as const },
        { wMax: 4.5, hMax: null, section: "90 x 84 x 1.95", fix: 2 as const, outsideTable: true },
      ],
      price_per_panel: 42.5,
    };
    expect(PanelRowSchema.safeParse(row).success).toBe(true);
    const entity = fromPanelRow(row);
    expect(entity).toMatchObject({
      id: "id-1", createdAt: row.created_at, updatedAt: row.updated_at, notes: "a note",
      type: 78, label: "P78", ctrackStock: 6, maxHVert: 6, spanVert: row.span_vert,
      spanHoriz: row.span_horiz, cornerPost: row.corner_post, horizCtrack: row.horiz_ctrack,
      pricePerPanel: 42.5,
    });
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    const backToRow = toPanelRow(withoutStamp);
    expect(backToRow).toEqual({
      notes: "a note", type: 78, label: "P78", depth: "78 mm", frl: "-/120/120", pack: 14,
      ctrack_stock: 6, ctrack_dim: "55 x 82 x 55", jtrack_dim: "55 x 82 x 90",
      max_h_vert: 6, max_h_horiz: 6, span_vert: row.span_vert, span_horiz: row.span_horiz,
      corner_post: row.corner_post, horiz_ctrack: row.horiz_ctrack, price_per_panel: 42.5,
    });
  });

  it("round-trips a track row, mapping notes/bmt/panelType/price null <-> undefined", () => {
    const row = {
      ...rowBase, notes: null, kind: "c-track" as const, system: "internal" as const,
      label: "P51 vertical C-track", dim: "55 x 56 x 55", bmt: null, panel_type: 51, stock_lengths: [3, 6],
      price_per_metre: null,
    };
    const entity = fromTrackRow(row);
    expect(entity.notes).toBeUndefined();
    expect(entity.bmt).toBeUndefined();
    expect(entity.panelType).toBe(51);
    expect(entity.pricePerMetre).toBeUndefined();
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toTrackRow(withoutStamp)).toEqual({
      notes: null, kind: "c-track", system: "internal", label: "P51 vertical C-track",
      dim: "55 x 56 x 55", bmt: null, panel_type: 51, stock_lengths: [3, 6], price_per_metre: null,
    });
  });

  it("round-trips a fixing row", () => {
    const row = {
      ...rowBase, notes: null, code: "10g-30", gauge: "10g", length_mm: 30, use: "Perimeter", per_box: 1000,
      price_per_box: 85,
    };
    const entity = fromFixingRow(row);
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toFixingRow(withoutStamp)).toEqual({
      notes: null, code: "10g-30", gauge: "10g", length_mm: 30, use: "Perimeter", per_box: 1000, price_per_box: 85,
    });
  });

  it("round-trips a sealant row", () => {
    const row = {
      ...rowBase, notes: null, system: "internal" as const, product: "Hilti CP606", m2_per_sausage: 4, per_box: 20,
      price_per_box: 220,
    };
    const entity = fromSealantRow(row);
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toSealantRow(withoutStamp)).toEqual({
      notes: null, system: "internal", product: "Hilti CP606", m2_per_sausage: 4, per_box: 20, price_per_box: 220,
    });
  });

  it("round-trips a colour row", () => {
    const row = { ...rowBase, notes: null, label: "Off White", code: "OW", hex: "#F5F2EC" };
    const entity = fromColourRow(row);
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toColourRow(withoutStamp)).toEqual({ notes: null, label: "Off White", code: "OW", hex: "#F5F2EC" });
  });

  it("rejects a panel row with a missing required field or a wrong type", () => {
    const { label: _label, ...missingLabel } = {
      ...rowBase, notes: null, label: "P78", type: 78, depth: "78 mm", frl: "-/120/120", pack: 14,
      ctrack_stock: 6, ctrack_dim: "x", jtrack_dim: "x", max_h_vert: 6, max_h_horiz: 6,
      span_vert: { maxW: "a", maxH: "b" }, span_horiz: [], corner_post: [], horiz_ctrack: [],
    };
    expect(PanelRowSchema.safeParse(missingLabel).success).toBe(false);
    expect(PanelRowSchema.safeParse({ ...missingLabel, label: "P78", pack: "not-a-number" }).success).toBe(false);
  });
});
