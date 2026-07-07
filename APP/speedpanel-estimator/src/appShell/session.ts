// =============================================================================
// Session persistence
// =============================================================================
// The current view (which system/orientation, project-vs-single mode, and
// unit) is saved alongside the wall project so reopening the app restores
// the exact screen. Kept separate from the wall data (PROJECT_KEY) since
// it's parent-level.
// =============================================================================
import { SYSTEMS } from "./systems";

const SESSION_KEY = "speedpanel:session";
export interface PersistedSession { v: number; system: string; mode: string; dimUnit: string; }

export function loadSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !SYSTEMS.some(sys => sys.id === s.system)) return null;
    return s as PersistedSession;
  } catch {
    return null;
  }
}

export function saveSession(session: PersistedSession) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}
