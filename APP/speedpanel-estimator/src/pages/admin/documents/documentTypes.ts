// =============================================================================
// Admin Documents -- catalog entity types
// =============================================================================
// A staging catalog for the Education Hub's document metadata, deliberately
// independent of src/education/catalog.ts's EduDocument/EduSection -- same
// "parallel admin dataset" pattern as src/pages/admin/products/productTypes.ts. Editing
// these types can never affect the live Education Hub. CatalogEntity isn't
// imported from productTypes.ts for the same reason: the two admin sections
// stay decoupled from each other, not just from their respective live data.
// =============================================================================
import type { EduCategory } from "../../../education/catalog";

interface CatalogEntity { id: string; createdAt: string; updatedAt: string; notes?: string; }

// "All" is a filter-only pseudo-category in Education Hub (see FilterChips.tsx/
// EducationHub.tsx), never a real document's own category.
export type AdminDocCategory = Exclude<EduCategory, "All">;

// A type alias (not interface) so it structurally satisfies
// RepeatableRowEditor<T extends Record<string, unknown>>'s generic constraint --
// see the same pattern in productTypes.ts's AdminPanel["spanHoriz"] row shape.
export type AdminDocSection = { name: string; description: string; pages: string; };

export interface AdminDocument extends CatalogEntity {
  title: string;
  category: AdminDocCategory;
  tags: string[];
  description: string;
  edition: string;
  date: string;
  fileSize: string;
  fileType: string;
  pageCount: number;
  swatch: string;
  sections: AdminDocSection[];
  // Manual path under public/docs/..., mirroring EduDocument.fileUrl -- there's
  // no upload/file-storage backend in this staging catalog.
  fileUrl?: string;
}
