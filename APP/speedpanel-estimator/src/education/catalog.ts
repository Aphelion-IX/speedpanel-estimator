// =============================================================================
// Education Hub -- document catalog
// =============================================================================
// Catalog types + shared lookups for the Education Hub tab. Document data
// itself is fetched live from Supabase (see educationCatalogStore.ts), not
// read from this file.
// =============================================================================
import { cx, BLUE, GOLD } from "../styleTokens";

export interface EduSection { name: string; description: string; pages: string; }
export interface EduDocument {
  id: string; title: string; category: string; tags: string[]; description: string;
  edition: string; date: string; fileSize: string; fileType: string; pageCount: number;
  swatch: string; sections: EduSection[];
  // Real documents only -- path under public/, resolved against Vite's BASE_URL so
  // it works both in dev and once deployed under the GitHub Pages subpath. Mock
  // entries with no real PDF yet simply omit this field.
  fileUrl?: string;
  // Full extracted PDF text (admin_documents.search_text), used by
  // EducationHub's search box in addition to the metadata fields below.
  // Empty/undefined for mock entries with no PDF.
  searchText?: string;
}
export const EDU_CATEGORIES = [
  "All", "Technical Guides", "Installation", "Connection Details",
  "Fire & Acoustic", "External Walls", "Estimating", "Compliance",
] as const;
export type EduCategory = typeof EDU_CATEGORIES[number];

// admin_documents.swatch is stored as a colour KEY ("blue"/"gold"/"slate"), not a
// literal value, since the DB can't reference the BLUE/GOLD CSS-variable tokens
// directly; EDU_SWATCH_MAP resolves it below. NAVY is deliberately
// excluded from the rotation -- in dark mode that token is repurposed as the primary-text
// colour (a near-white neutral for legibility), not an actual navy fill, so using it here
// would render a white icon on a near-white block. "#334155" (Tailwind slate-700) is a
// theme-stable neutral used the same way the app already hardcodes slate-700 elsewhere.
export const EDU_SWATCH_MAP: Record<string, string> = { blue: BLUE, gold: GOLD, slate: "#334155" };

// Shared "category" badge look -- reuses the app's existing hardcoded info-badge
// convention (see cx.infoNote/cx.infoBox) rather than inventing a new token.
export const eduBadgeCx = cx.badge + " bg-blue-50 dark:bg-blue-900/55 text-blue-700 dark:text-blue-300";
