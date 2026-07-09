// =============================================================================
// Admin Documents -- Supabase row <-> entity mappers
// =============================================================================
// supabase/schema.sql's admin_documents columns are snake_case; AdminDocument
// is camelCase -- same 1:1 rename pattern as products/productMappers.ts.
//
// AdminDocumentRow is a Zod schema (not a plain interface) so documentStore.ts
// can validate what actually comes back from Supabase -- see
// products/productMappers.ts's header comment for why.
// =============================================================================
import { z } from "zod";
import type { AdminDocument } from "./documentTypes";

// "All" is a filter-only pseudo-category (see documentTypes.ts's AdminDocCategory),
// never a real document's own category.
const adminDocCategorySchema = z.enum([
  "Technical Guides", "Installation", "Connection Details",
  "Fire & Acoustic", "External Walls", "Estimating", "Compliance",
]);

const adminDocSectionSchema = z.object({ name: z.string(), description: z.string(), pages: z.string() });

export const AdminDocumentRowSchema = z.object({
  id: z.string(), created_at: z.string(), updated_at: z.string(), notes: z.string().nullable(),
  title: z.string(), category: adminDocCategorySchema, tags: z.array(z.string()), description: z.string(),
  edition: z.string(), date: z.string(), file_size: z.string(), file_type: z.string(),
  page_count: z.number(), swatch: z.string(), sections: z.array(adminDocSectionSchema), file_url: z.string().nullable(),
});
export type AdminDocumentRow = z.infer<typeof AdminDocumentRowSchema>;

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
