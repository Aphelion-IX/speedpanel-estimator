// =============================================================================
// Saved projects -- row/data types
// =============================================================================
// Mirrors the projects table's columns (see supabase/schema.sql), same
// convention as projects/requests/requestTypes.ts. SavedProjectData is the shape
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

export const REVIEW_STATUSES = ["pending", "approved", "changes_requested"] as const;
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
  // Company workspace fields (see supabase/schema.sql's "Multi-user company
  // workspaces" section) -- both null means an ordinary solo project,
  // unchanged from before that section existed.
  company_id: z.string().nullable(),
  project_manager_user_id: z.string().nullable(),
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

// Same slate/blue/amber/emerald convention as orders/orderTypes.ts's
// ORDER_STAGE_BADGE_CLASS, so both pipelines' badges read consistently.
export const PROJECT_STAGE_BADGE_CLASS: Record<Stage, string> = {
  draft: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400",
  install_review: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  technical_review: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
};

// install_review_status/technical_review_status badge colours -- same
// slate/blue/amber/emerald convention as PROJECT_STAGE_BADGE_CLASS above.
export const REVIEW_STATUS_BADGE_CLASS: Record<ReviewStatus, string> = {
  pending: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
  changes_requested: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
};
