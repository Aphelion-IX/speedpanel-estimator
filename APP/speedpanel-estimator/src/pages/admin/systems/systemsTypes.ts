// =============================================================================
// Admin Systems -- locked-data row types
// =============================================================================
// A localStorage staging catalog for the "Locked system data" reference
// tables (see src/data.ts's INT_LOCKED/EXT_LOCKED, rendered read-only today by
// src/ui/lockedData.tsx). Deliberately independent of data.ts's plain
// string[][] shape -- same "parallel admin dataset" pattern as productTypes.ts/
// documentTypes.ts. Editing these rows can never affect the live calculators.
// =============================================================================
import { z } from "zod";

export type SystemId = "internal" | "external";

// A type alias (not interface) so it structurally satisfies
// RepeatableRowEditor<T extends Record<string, unknown>>'s generic
// constraint -- same reasoning as AdminDocSection in documentTypes.ts.
// value === "" represents a section-header row, mirroring LDRow's
// row.length === 1 convention in src/ui/lockedData.tsx.
export type LockedRow = { key: string; value: string };

// The system_locked_rows table's row shape (see supabase/schema.sql) -- a
// Zod schema (not a plain interface) so systemsStore.ts can validate what
// actually comes back from Supabase, same reasoning as
// admin/products/productMappers.ts's header comment.
export const SystemLockedRowsRowSchema = z.object({
  system: z.enum(["internal", "external"]),
  rows: z.array(z.object({ key: z.string(), value: z.string() })),
});
