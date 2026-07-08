// =============================================================================
// Admin Systems -- locked-data row types
// =============================================================================
// A localStorage staging catalog for the "Locked system data" reference
// tables (see src/data.ts's INT_LOCKED/EXT_LOCKED, rendered read-only today by
// src/ui/lockedData.tsx). Deliberately independent of data.ts's plain
// string[][] shape -- same "parallel admin dataset" pattern as productTypes.ts/
// documentTypes.ts. Editing these rows can never affect the live calculators.
// =============================================================================
export type SystemId = "internal" | "external";

// A type alias (not interface) so it structurally satisfies
// RepeatableRowEditor<T extends Record<string, unknown>>'s generic
// constraint -- same reasoning as AdminDocSection in documentTypes.ts.
// value === "" represents a section-header row, mirroring LDRow's
// row.length === 1 convention in src/ui/lockedData.tsx.
export type LockedRow = { key: string; value: string };
