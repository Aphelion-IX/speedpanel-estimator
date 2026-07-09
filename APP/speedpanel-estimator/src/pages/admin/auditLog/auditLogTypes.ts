// =============================================================================
// Admin Audit Log -- row types
// =============================================================================
// Mirrors admin_list_stage_events()'s return shape (see supabase/schema.sql)
// -- a security definer RPC, not a direct select, since it joins in the
// project name and actor email (auth.users isn't otherwise queryable).
// =============================================================================
import { z } from "zod";

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

export const AdminStageEventRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_name: z.string(),
  actor_id: z.string().nullable(),
  actor_email: z.string().nullable(),
  event_type: z.enum(STAGE_EVENT_TYPES),
  note: z.string().nullable(),
  created_at: z.string(),
});
export type AdminStageEventRow = z.infer<typeof AdminStageEventRowSchema>;
