/** @vitest-environment jsdom */
// =============================================================================
// useProjectPhoneStats -- per-wall Internal/External dispatch
// =============================================================================
// The stats must dispatch on each wall's own `application`, not on the
// project-level legacy `system` field: a project can mix Internal and
// External walls (CLAUDE.md, "Estimator UI architecture"), so a project-level
// switch silently runs every wall through the wrong compute pipeline.
// =============================================================================
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectPhoneStats } from "./projectPhoneStats";
import { parseProjectRow } from "./projectTypes";
import { defaultWall } from "../../wallStore";
import { compute, computeExternal } from "../../estimate/computeWall";
import type { ProjectRow } from "./projectTypes";

function row(walls: unknown[], system = "int-vert"): ProjectRow {
  const parsed = parseProjectRow({
    id: "p1", owner_id: "u1", name: "Test project",
    data: {
      v: 1, walls, activeId: 1, nextId: walls.length + 1,
      projectStock: "", projectLock: false, customLengthInput: "", customActive: false,
      system, dimUnit: "m",
    },
    stage: "draft",
    install_review_status: null, install_review_note: null,
    technical_review_status: null, technical_review_note: null,
    company_id: null, project_manager_user_id: null,
    builder_name: null, start_date: null, project_number: null,
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  });
  if (!parsed) throw new Error("fixture failed ProjectRowSchema validation");
  return parsed;
}

// An ordinary wall both pipelines handle identically.
const plain = (id: number, application: "internal" | "external") => ({
  ...defaultWall(id, "vertical", application), type: 51 as const, width: "6", height: "3",
});
// A wall the two pipelines genuinely disagree about: at 7.5 m a P51 vertical
// wall is past Internal's height limit (compute() returns `empty` plus a
// warning), while External computes it normally. This is what makes the
// dispatch observable rather than incidental.
const tall = (id: number, application: "internal" | "external") => ({
  ...defaultWall(id, "vertical", application), type: 51 as const, width: "6", height: "7.5",
});

const panelsOf = (out: ReturnType<typeof compute>) => out.chosen?.panels ?? out.result?.panels ?? 0;

describe("useProjectPhoneStats", () => {
  it("counts every wall in the project", () => {
    const { result } = renderHook(() => useProjectPhoneStats(row([plain(1, "internal"), plain(2, "internal")])));
    expect(result.current.wallCount).toBe(2);
  });

  it("runs an External wall through computeExternal even when the project's legacy system is Internal", () => {
    const wall = tall(1, "external");
    const { result } = renderHook(() => useProjectPhoneStats(row([wall], "int-vert")));

    // Guard: this test only means something while the two pipelines disagree.
    expect(compute(wall).empty).toBe(true);
    expect(computeExternal(wall).empty).toBe(false);

    expect(result.current.panels).toBe(panelsOf(computeExternal(wall)));
    expect(result.current.panels).toBeGreaterThan(0);
    expect(result.current.warnings).toBe(0);
  });

  it("sums a mixed Internal/External project per wall rather than through one pipeline", () => {
    const internalWall = plain(1, "internal");
    const externalWall = tall(2, "external");
    const { result } = renderHook(() => useProjectPhoneStats(row([internalWall, externalWall], "int-vert")));

    const expectedPanels = panelsOf(compute(internalWall)) + panelsOf(computeExternal(externalWall));

    expect(result.current.wallCount).toBe(2);
    expect(result.current.panels).toBe(expectedPanels);
    // Dispatching the whole project through Internal (the old project-level
    // `system` behaviour) would drop the External wall entirely and surface
    // its height warning instead.
    expect(result.current.panels).toBeGreaterThan(panelsOf(compute(internalWall)));
    expect(result.current.warnings).toBe(0);
  });

  it("reports zeroed totals for a project whose walls have no dimensions yet", () => {
    const { result } = renderHook(() => useProjectPhoneStats(row([defaultWall(1, "vertical")])));
    expect(result.current.wallCount).toBe(1);
    expect(result.current.area).toBe(0);
    expect(result.current.panels).toBe(0);
  });
});
