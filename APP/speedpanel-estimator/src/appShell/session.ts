// =============================================================================
// Session persistence
// =============================================================================
// The current view (which system/orientation and unit) is saved alongside
// the wall project so reopening the app restores the exact screen. Kept
// separate from the wall data (PROJECT_KEY) since it's parent-level.
//
// PersistedSession is a Zod schema (not a plain interface) so loadSession()
// can validate what it actually finds in localStorage before trusting it --
// same reasoning as wallStore.ts's PersistedProjectSchema, though much lower
// stakes here: dimUnit only ever picks which unit a value displays in
// (computeUtils.ts's makeToM/makeToDisp already fall back safely on any
// dimUnit that isn't exactly "mm"), not the compute engine's own inputs.
// A stored `mode` field from before single-wall mode was retired is simply
// ignored -- Zod drops unknown keys on parse rather than rejecting them.
// =============================================================================
import { z } from "zod";
import { SYSTEMS } from "./systems";

const SESSION_KEY = "speedpanel:session";

export const PersistedSessionSchema = z.object({
  v: z.number(),
  system: z.string().refine(id => SYSTEMS.some(sys => sys.id === id), "Unknown system id"),
  dimUnit: z.string(),
});
export type PersistedSession = z.infer<typeof PersistedSessionSchema>;

export function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    const parsed = PersistedSessionSchema.safeParse(s);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}
