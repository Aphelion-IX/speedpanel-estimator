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
// =============================================================================
import type { PersistedProject } from "../../wallStore";

export type Stage = "draft" | "install_review" | "technical_review" | "approved";
export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface SavedProjectData extends PersistedProject {
  system: string;
  mode: string;
  dimUnit: string;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  data: SavedProjectData;
  stage: Stage;
  install_review_status: ReviewStatus | null;
  install_review_note: string | null;
  technical_review_status: ReviewStatus | null;
  technical_review_note: string | null;
  created_at: string;
  updated_at: string;
}

export const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  install_review: "Install review",
  technical_review: "Technical review",
  approved: "Approved",
};

export const STAGES: Stage[] = ["draft", "install_review", "technical_review", "approved"];
