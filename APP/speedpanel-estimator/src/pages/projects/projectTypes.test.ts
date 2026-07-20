import { describe, it, expect } from "vitest";
import { defaultWall } from "../../wallStore";
import { parseProjectRow, parseProjectRows } from "./projectTypes";

// Minimal but complete ProjectRowSchema-shaped row, matching the fields every
// projects-table read validates (see projectTypes.ts's ProjectRowSchema).
function validRow(overrides: { walls?: unknown[] } = {}) {
  return {
    id: "p1", owner_id: "u1", name: "Test project",
    data: {
      v: 1,
      walls: overrides.walls ?? [defaultWall(1, "vertical")],
      activeId: 1, nextId: 2,
      projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
      system: "int-vert", dimUnit: "m",
    },
    stage: "draft",
    install_review_status: null, install_review_note: null,
    technical_review_status: null, technical_review_note: null,
    company_id: null, project_manager_user_id: null,
    builder_name: null, start_date: null, project_number: null,
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("parseProjectRow / parseProjectRows", () => {
  it("parses an ordinary row unchanged", () => {
    const parsed = parseProjectRow(validRow());
    expect(parsed).not.toBeNull();
    expect(parsed!.data.walls[0].orient).toBe("vertical");
  });

  it("backfills a legacy row whose wall predates per-wall orient (regression: Projects list 'Unexpected data shape from the server')", () => {
    const { orient: _orient, ...legacyWall } = defaultWall(1);
    const row = validRow({ walls: [legacyWall] });
    const parsed = parseProjectRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.data.walls[0].orient).toBe("vertical");
  });

  it("backfills a legacy row whose wall predates per-wall application, deriving the default from the row's own (legacy, project-level) system", () => {
    const { application: _application, ...legacyWall } = defaultWall(1);
    const row = validRow({ walls: [legacyWall] });
    row.data.system = "ext-vert";
    const parsed = parseProjectRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.data.walls[0].application).toBe("external");
  });

  it("backfills application to \"internal\" for a legacy row whose system was an Internal one", () => {
    const { application: _application, ...legacyWall } = defaultWall(1);
    const row = validRow({ walls: [legacyWall] });
    row.data.system = "int-horiz";
    const parsed = parseProjectRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.data.walls[0].application).toBe("internal");
  });

  it("parseProjectRows backfills every legacy row in a list, not just the first", () => {
    const { orient: _orient, ...legacyWall } = defaultWall(1);
    const rows = [
      validRow({ walls: [defaultWall(1, "horizontal")] }),
      validRow({ walls: [legacyWall] }),
    ];
    const parsed = parseProjectRows(rows);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].data.walls[0].orient).toBe("horizontal");
    expect(parsed[1].data.walls[0].orient).toBe("vertical");
  });

  it("still rejects a genuinely malformed row on its own (single-row detail fetch)", () => {
    const { name: _name, ...broken } = validRow();
    expect(parseProjectRow(broken)).toBeNull();
  });

  it("parseProjectRows skips a corrupted row instead of failing the whole list (regression: a stray {id, orient}-only wall took the entire Projects page down)", () => {
    // Reproduces the row actually found in production: a wall reduced to
    // just {id, orient}, missing every other required WallSchema field --
    // far more broken than the legacy-orient case above, which
    // backfillOrient can't (and shouldn't try to) paper over. The list
    // should still return every OTHER valid row, not error out entirely.
    const good = validRow();
    const corrupted = validRow({ walls: [{ id: 1, orient: "vertical" }] });
    const parsed = parseProjectRows([good, corrupted]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(good.id);
  });
});
