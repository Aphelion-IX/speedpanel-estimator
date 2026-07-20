// =============================================================================
// Saved projects -- row/data types
// =============================================================================
// Mirrors the projects table's columns (see supabase/schema.sql), same
// convention as projects/requests/requestTypes.ts. SavedProjectData is the shape
// stored in the `data` jsonb column -- wallStore.ts's PersistedProject
// extended with the view-state fields appShell/session.ts persists separately
// today (system/dimUnit), so reopening a project restores the exact
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
import { tone } from "../../styleTokens";
import { PersistedProjectSchema, backfillOrient, backfillApplication } from "../../wallStore";
import { SYSTEMS } from "../../appShell/systems";

export const STAGES = ["draft", "install_review", "technical_review", "approved"] as const;
export type Stage = typeof STAGES[number];

export const REVIEW_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export const SavedProjectDataSchema = PersistedProjectSchema.extend({
  system: z.string(), dimUnit: z.string(),
  // Optional project metadata, editable from the Projects list's create form
  // and ProjectDetailPage.tsx -- stored here (not new `projects` SQL columns)
  // since this jsonb `data` blob already carries exactly this kind of
  // project-level-but-not-wall-config metadata (system/dimUnit above).
  // Optional so projects saved before these fields existed still validate.
  reference: z.string().optional(),
  siteAddress: z.string().optional(),
  customerName: z.string().optional(),
  description: z.string().optional(),
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
  // Projects Experience Redesign fields (see supabase/schema.sql) -- all new,
  // additive columns; deliberately NOT a migration of data.reference/
  // siteAddress/customerName (which stay exactly where they already live).
  // project_number is server-assigned (never client-settable, see
  // assign_project_number()); nullable only because rows created before this
  // column existed have none.
  builder_name: z.string().nullable(),
  start_date: z.string().nullable(),
  project_number: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProjectRow = z.infer<typeof ProjectRowSchema>;

// Patches a raw (pre-validation) Supabase project row's data.walls the same
// way wallStore.ts's loadProject() already does for device-local saves --
// WallSchema.orient/application have no default, so a project saved before
// per-wall orientation/application existed fails ProjectRowSchema validation
// outright otherwise. application's legacy default comes from the project's
// own (project-level, pre-merge) `system` field -- every wall in a project
// saved before Internal/External became per-wall belonged to whichever one
// calculator that project's `system` selected.
function patchLegacyProjectRow(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const row = raw as { data?: unknown };
  if (!row.data || typeof row.data !== "object") return raw;
  const data = row.data as { walls?: unknown; system?: unknown };
  if (!Array.isArray(data.walls)) return raw;
  const legacySystem = typeof data.system === "string" ? SYSTEMS.find(s => s.id === data.system) : undefined;
  const defaultApplication = legacySystem?.ext ? "external" : "internal";
  const walls = backfillApplication(backfillOrient(data.walls), defaultApplication);
  return { ...row, data: { ...data, walls } };
}

export function parseProjectRow(raw: unknown): ProjectRow | null {
  const parsed = ProjectRowSchema.safeParse(patchLegacyProjectRow(raw));
  return parsed.success ? parsed.data : null;
}

// Parses each row independently and drops (with a console warning, not a
// thrown/returned error) any that don't validate, instead of failing the
// whole list the way a single .array().safeParse() call would. A corrupted
// or hand-inserted row (missing far more than just `orient` -- e.g. seen in
// production, a wall object reduced to just `{id, orient}`) shouldn't be
// able to take the entire Projects page down with "Unexpected data shape
// from the server" for every row in the result set; it should just be
// invisible until whoever owns that row's data fixes or removes it.
export function parseProjectRows(raw: unknown[]): ProjectRow[] {
  const out: ProjectRow[] = [];
  for (const item of raw) {
    const parsed = ProjectRowSchema.safeParse(patchLegacyProjectRow(item));
    if (parsed.success) out.push(parsed.data);
    else console.warn("Skipping a project row that failed validation:", parsed.error.issues, item);
  }
  return out;
}

export const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  install_review: "Install review",
  technical_review: "Technical review",
  approved: "Approved",
};

// Same shared tone() map as orders/orderTypes.ts's ORDER_STAGE_BADGE_CLASS,
// so both pipelines' badges read consistently.
export const PROJECT_STAGE_BADGE_CLASS: Record<Stage, string> = {
  draft: tone("neutral"),
  install_review: tone("info"),
  technical_review: tone("warn"),
  approved: tone("ok"),
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
};

// install_review_status/technical_review_status badge colours -- same
// shared tone() map as PROJECT_STAGE_BADGE_CLASS above.
export const REVIEW_STATUS_BADGE_CLASS: Record<ReviewStatus, string> = {
  pending: tone("info"),
  changes_requested: tone("warn"),
  approved: tone("ok"),
};
