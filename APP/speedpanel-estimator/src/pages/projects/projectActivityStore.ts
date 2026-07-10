// =============================================================================
// Project activity feed
// =============================================================================
// Feeds ProjectDetailPage.tsx's "Activity" card -- a real feed from
// project_stage_events (see supabase/schema.sql), already RLS-readable by
// the project's owner ("Owners and admins can read project stage events"),
// just never surfaced anywhere customer-facing before now -- only the Admin
// audit log (admin/auditLog/) reads it today, via a joined RPC. This is a
// plain select instead (already scoped to one project_id, no project
// name/actor email join needed the way the admin-wide audit log requires).
//
// STAGE_EVENT_TYPES/LABELS are duplicated from admin/auditLog/auditLogTypes.ts
// rather than imported -- same "duplicated, not shared" convention
// education/educationCatalogStore.ts documents for this exact admin/customer
// boundary, so this customer-facing page's bundle stays independent of the
// (separately, lazily loaded) admin section's code.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "../../lib/supabaseClient";

const NOT_CONFIGURED = "Activity isn't configured for this environment.";
const BAD_SHAPE = "Unexpected data shape from the server.";

export const STAGE_EVENT_TYPES = [
  "install_review_requested", "install_review_approved", "install_review_changes_requested",
  "technical_review_requested", "technical_review_approved", "technical_review_changes_requested",
] as const;
export type StageEventType = typeof STAGE_EVENT_TYPES[number];

export const STAGE_EVENT_LABELS: Record<StageEventType, string> = {
  install_review_requested: "Install review requested",
  install_review_approved: "Install review approved",
  install_review_changes_requested: "Install review changes requested",
  technical_review_requested: "Technical review requested",
  technical_review_approved: "Technical review approved",
  technical_review_changes_requested: "Technical review changes requested",
};

const ProjectActivityRowSchema = z.object({
  id: z.string(),
  event_type: z.enum(STAGE_EVENT_TYPES),
  note: z.string().nullable(),
  created_at: z.string(),
});
export type ProjectActivityRow = z.infer<typeof ProjectActivityRowSchema>;

interface ActivityState {
  events: ProjectActivityRow[];
  loading: boolean;
  error: string | null;
}

export function useProjectActivity(projectId: string) {
  const [state, setState] = useState<ActivityState>(() =>
    supabase ? { events: [], loading: true, error: null } : { events: [], loading: false, error: NOT_CONFIGURED },
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setState(s => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase.from("project_stage_events")
      .select("id, event_type, note, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) { setState({ events: [], loading: false, error: error.message }); return; }
    const parsed = ProjectActivityRowSchema.array().safeParse(data ?? []);
    if (!parsed.success) { setState({ events: [], loading: false, error: BAD_SHAPE }); return; }
    setState({ events: parsed.data, loading: false, error: null });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: load };
}
