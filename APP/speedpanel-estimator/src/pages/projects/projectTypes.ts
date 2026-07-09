// =============================================================================
// Saved projects -- row/data types
// =============================================================================
// Mirrors the projects table's columns (see supabase/schema.sql), same
// convention as admin/requests/requestTypes.ts. SavedProjectData is the shape
// stored in the `data` jsonb column -- wallStore.ts's PersistedProject
// extended with the view-state fields appShell/session.ts persists separately
// today (system/mode/dimUnit), so reopening a project restores the exact
// screen, not just the wall list. Deliberately not merged into
// PersistedProject itself -- that type is the device-local single-project
// shape and stays independent of the multi-project Supabase shape built here.
//
// SavedProjectData/ProjectRow are Zod schemas (not plain interfaces) so
// projectsStore.ts/projectDetailStore.ts/adminProjectsStore.ts can validate
// what actually comes back from Supabase -- ProjectRowSchema's `data` field
// is SavedProjectDataSchema, so a row read is validated all the way down to
// individual Wall fields, the same schema loadFrom()'s caller uses to guard
// the compute engine itself (see wallStore.ts's WallSchema/PersistedProjectSchema).
// =============================================================================
import { z } from "zod";
import { PersistedProjectSchema } from "../../wallStore";

export const STAGES = ["draft", "install_review", "technical_review", "approved"] as const;
export type Stage = typeof STAGES[number];

const REVIEW_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export const SavedProjectDataSchema = PersistedProjectSchema.extend({
  system: z.string(), mode: z.string(), dimUnit: z.string(),
});
export type SavedProjectData = z.infer<typeof SavedProjectDataSchema>;

export const ProjectRowSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  name: z.string(),
  data: SavedProjectDataSchema,
  stage: z.enum(STAGES),
  install_review_status: z.enum(REVIEW_STATUSES).nullable(),
  install_review_note: z.string().nullable(),
  technical_review_status: z.enum(REVIEW_STATUSES).nullable(),
  technical_review_note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProjectRow = z.infer<typeof ProjectRowSchema>;

export const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  install_review: "Install review",
  technical_review: "Technical review",
  approved: "Approved",
};
