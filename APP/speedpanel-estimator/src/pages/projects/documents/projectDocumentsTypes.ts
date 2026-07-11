// =============================================================================
// Project documents -- row type
// =============================================================================
// Mirrors project_documents' columns verbatim (see supabase/schema.sql) --
// same snake_case convention as every other *RowSchema in this codebase.
// =============================================================================
import { z } from "zod";

export const ProjectDocumentRowSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  uploaded_by: z.string(),
  storage_path: z.string(),
  file_name: z.string(),
  file_size: z.number(),
  content_type: z.string().nullable(),
  created_at: z.string(),
});
export type ProjectDocumentRow = z.infer<typeof ProjectDocumentRowSchema>;

export const PROJECT_DOCUMENTS_BUCKET = "project-documents";

// Nearest whole unit, no decimals under 10 MB -- this is a file-list byline,
// not a precise measurement.
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
