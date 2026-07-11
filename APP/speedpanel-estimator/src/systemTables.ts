// =============================================================================
// Editable per-panel-type decision tables
// =============================================================================
// Single source of truth for the corner-post / horizontal-C-track / shaft
// vertical-track lookup tables consumed by src/estimate/spanLookups.ts.
// Mirrors src/mathConstants.ts's contract exactly: data.ts reads these once at
// module load via loadSystemTables(), so every existing lookup keeps working
// unchanged -- this file only decides what the tables start out as.
//
// Overrides are staged in localStorage by the Admin > Maths page (see
// pages/admin/maths/systemTablesStore.ts for the Supabase cross-device layer).
// Like mathConstants.ts, this is a Zod schema (not a plain interface) so both
// the localStorage read and the Supabase read can validate what they find
// before data.ts's synchronous module-load read trusts it.
//
// hMax uses a nullable number (null = unbounded) rather than Infinity: Infinity
// does not survive JSON.stringify (localStorage / Supabase jsonb both turn it
// into null anyway), so this makes the "unbounded" representation explicit and
// round-trip-safe instead of silently relying on JSON's lossy behaviour.
// =============================================================================
import { z } from "zod";

const FixPerCourseSchema = z.union([z.literal(1), z.literal(2)]);

const CornerPostRowSchema = z.object({
  maxH: z.number(),
  section: z.string(),
  fixPerCourse: FixPerCourseSchema.optional(),
});
const CornerPostBandSchema = z.object({
  maxW: z.number(),
  rows: z.array(CornerPostRowSchema),
});
const HorizCtrackBandSchema = z.object({
  wMax: z.number(),
  hMax: z.number().nullable(),
  section: z.string(),
  fix: FixPerCourseSchema,
  outsideTable: z.boolean().optional(),
});
const ShaftTrackRowSchema = z.object({
  maxF: z.number(),
  section: z.string(),
  fixPerCourse: FixPerCourseSchema,
});

export const SystemTablesSchema = z.object({
  // Keyed by panel type as a string ("51"/"64"/"78") -- Zod's z.record requires
  // string keys, and JSON round-trips numeric object keys as strings anyway.
  cornerPost: z.record(z.string(), z.array(CornerPostBandSchema)),
  horizCtrack: z.record(z.string(), z.array(HorizCtrackBandSchema)),
  shaftTrack: z.array(ShaftTrackRowSchema),
});
export type SystemTables = z.infer<typeof SystemTablesSchema>;
export type CornerPostBand = z.infer<typeof CornerPostBandSchema>;
export type HorizCtrackBand = z.infer<typeof HorizCtrackBandSchema>;
export type ShaftTrackRow = z.infer<typeof ShaftTrackRowSchema>;

// Byte-for-byte copy of the literals that used to be inlined in data.ts's
// PANELS array (cornerPost/horizCtrack per type) and its SHAFT_TRACK_TABLE, so
// first-deploy behaviour is unchanged. Edit these via Admin > Maths, not here.
export const SYSTEM_TABLES_DEFAULTS: SystemTables = {
  cornerPost: {
    "51": [
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 56 x 1.15" }, { maxH: 4.0, section: "55 x 57 x 1.50" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 57 x 1.50" }, { maxH: 4.0, section: "55 x 58 x 1.95" }, { maxH: 5.0, section: "55 x 58 x 1.95" }] },
    ],
    "64": [
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "55 x 68 x 1.15" }, { maxH: 4.0, section: "55 x 69 x 1.50" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "55 x 69 x 1.50" }, { maxH: 4.0, section: "55 x 70 x 1.95" }, { maxH: 5.0, section: "55 x 70 x 1.95" }] },
    ],
    // H <= 4.5 m only -- the H > 4.5 m band (up to 6.0 m) is handled separately
    // in pickCornerPost due to the footnote width-breakpoint shift (3.0 m -> 3.5 m at 6.0 m tall).
    "78": [
      { maxW: 3.0, rows: [{ maxH: 3.0, section: "90 x 82 x 1.15" }, { maxH: 4.5, section: "90 x 83 x 1.50" }] },
      { maxW: 4.5, rows: [{ maxH: 3.0, section: "90 x 83 x 1.50" }, { maxH: 4.5, section: "90 x 84 x 1.95" }] },
    ],
  },
  horizCtrack: {
    "51": [
      { wMax: 3.0, hMax: 3.0, section: "55 x 56 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 57 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 58 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: null, section: "55 x 58 x 1.95", fix: 1, outsideTable: true },
    ],
    "64": [
      { wMax: 3.0, hMax: 3.0, section: "55 x 68 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.0, section: "55 x 69 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 5.0, section: "55 x 70 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: null, section: "55 x 70 x 1.95", fix: 1, outsideTable: true },
    ],
    "78": [
      { wMax: 3.0, hMax: 3.0, section: "90 x 82 x 1.15", fix: 1 },
      { wMax: 4.5, hMax: 3.0, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 3.0, hMax: 4.5, section: "90 x 83 x 1.50", fix: 1 },
      { wMax: 4.5, hMax: 4.5, section: "90 x 84 x 1.95", fix: 1 },
      // P78 tall-wall band: the 1-screw width breakpoint drops to 3.5 m at 4.5-6.0 m tall.
      { wMax: 3.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 1 },
      { wMax: 4.5, hMax: 6.0, section: "90 x 84 x 1.95", fix: 2 },
      { wMax: 4.5, hMax: null, section: "90 x 84 x 1.95", fix: 2, outsideTable: true },
    ],
  },
  // Shaft wall vertical track (see estimate_shaft_wall.md section 3). Not
  // per-type -- shaft walls are always forced to P78 elsewhere in the compute
  // engine -- sized by floor height alone.
  shaftTrack: [
    { maxF: 3.0, section: "90 x 82 x 1.50", fixPerCourse: 1 },
    { maxF: 4.5, section: "90 x 84 x 1.95", fixPerCourse: 1 },
    { maxF: 6.0, section: "90 x 84 x 1.95", fixPerCourse: 2 },
  ],
};

const STORAGE_KEY = "speedpanel:systemTables";

interface PersistedSystemTables { v: number; values: Partial<SystemTables>; }

const PartialSystemTablesSchema = SystemTablesSchema.partial();

export function loadSystemTables(): SystemTables {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as PersistedSystemTables;
        const parsed = p && p.v === 1 ? PartialSystemTablesSchema.safeParse(p.values) : null;
        if (parsed?.success) return { ...SYSTEM_TABLES_DEFAULTS, ...parsed.data };
      }
    } catch { /* ignore parse/access errors, fall through to defaults */ }
  }
  return SYSTEM_TABLES_DEFAULTS;
}

export function saveSystemTables(values: SystemTables): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedSystemTables = { v: 1, values };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* ignore quota/serialization errors */ }
}
