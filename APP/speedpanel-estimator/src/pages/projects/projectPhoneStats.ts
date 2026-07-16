// =============================================================================
// Project list -- phone card stats
// =============================================================================
// Derives the Walls/Area/Panels/Warnings numbers shown on a phone project
// card. item.data (the full SavedProjectData, including walls) is already
// loaded for every row by useProjects()'s select("*") -- no extra fetch here,
// just a per-row memoized re-run of the same compute pipeline the calculators
// themselves use. Not wired into the list's data-fetch layer on purpose: it's
// a pure, row-scoped derivation, cheap at the app's realistic project/wall
// counts (see this file's header note in the phone-redesign plan for the
// scale caveat if the list ever needs pagination).
// =============================================================================
import { useMemo } from "react";
import { compute, computeExternal } from "../../estimate/computeWall";
import { SYSTEMS } from "../../appShell/systems";
import type { ProjectRow } from "./projectTypes";

export interface ProjectPhoneStats { wallCount: number; area: number; panels: number; warnings: number; }

export function useProjectPhoneStats(item: ProjectRow): ProjectPhoneStats {
  return useMemo(() => {
    const isExt = SYSTEMS.find(s => s.id === item.data.system)?.ext ?? false;
    const fn = isExt ? computeExternal : compute;
    let area = 0, panels = 0, warnings = 0;
    for (const wall of item.data.walls) {
      const out = fn(wall);
      warnings += out.warnings.length;
      if (out.empty) continue;
      area += out.area ?? 0;
      panels += out.chosen?.panels ?? out.result?.panels ?? 0;
    }
    return { wallCount: item.data.walls.length, area, panels, warnings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.updated_at]);
}
