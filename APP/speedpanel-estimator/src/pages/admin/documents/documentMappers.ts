// =============================================================================
// Admin Documents -- Supabase row <-> entity mappers
// =============================================================================
// supabase/schema.sql's admin_documents columns are snake_case; AdminDocument
// is camelCase -- same 1:1 rename pattern as products/productMappers.ts.
// =============================================================================
import type { AdminDocument, AdminDocCategory } from "./documentTypes";

export interface AdminDocumentRow {
  id: string; created_at: string; updated_at: string; notes: string | null;
  title: string; category: AdminDocCategory; tags: string[]; description: string;
  edition: string; date: string; file_size: string; file_type: string;
  page_count: number; swatch: string; sections: AdminDocument["sections"]; file_url: string | null;
}

export function fromDocumentRow(row: AdminDocumentRow): AdminDocument {
  return {
    id: row.id, createdAt: row.created_at, updatedAt: row.updated_at, notes: row.notes ?? undefined,
    title: row.title, category: row.category, tags: row.tags, description: row.description,
    edition: row.edition, date: row.date, fileSize: row.file_size, fileType: row.file_type,
    pageCount: row.page_count, swatch: row.swatch, sections: row.sections, fileUrl: row.file_url ?? undefined,
  };
}

export function toDocumentRow(d: Omit<AdminDocument, "id" | "createdAt" | "updatedAt">) {
  return {
    notes: d.notes ?? null, title: d.title, category: d.category, tags: d.tags, description: d.description,
    edition: d.edition, date: d.date, file_size: d.fileSize, file_type: d.fileType,
    page_count: d.pageCount, swatch: d.swatch, sections: d.sections, file_url: d.fileUrl ?? null,
  };
}
