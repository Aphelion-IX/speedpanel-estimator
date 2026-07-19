// =============================================================================
// Admin section catalog -- shared data, no page components
// =============================================================================
// Emptied out deliberately -- the Admin Dashboard's tile content is being
// rebuilt from scratch. AdminSection/ADMIN_GROUPS' shape is kept (not
// deleted) so AdminDashboard.tsx and adminSectionAccess.ts keep compiling
// against the same contract while the new tile set gets built back up here.
// =============================================================================
import type { AdminSubPage } from "../../appShell/useHashRoute";

export type AdminSection = { key: AdminSubPage; label: string; description: string; icon: React.ReactNode };

export const ADMIN_GROUPS: { heading: string; items: AdminSection[] }[] = [];
