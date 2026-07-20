// =============================================================================
// Read-only gate
// =============================================================================
// Spec §13's "Read-only access" for a saved project: may view walls/results/
// warnings, copy/print/export, but may not change data, links, or save.
// Genuinely calculator-agnostic (no fork-not-share concern), so this lives
// in src/ui/ and is shared by both calculators.
//
// App.tsx's readOnlyProject is derived by useProjectEditAccess.ts, which
// mirrors supabase/schema.sql's can_edit_project() from already-loaded
// client state (project owner, internal staff, company role) plus one
// project_memberships lookup for the "viewer" case. Real enforcement is
// RLS's job regardless (a write fails server-side if unauthorized, per
// CLAUDE.md); this is the UX layer only.
// =============================================================================
import { Lock } from "lucide-react";
import { cx } from "../styleTokens";

export const ReadOnlyBanner = () => (
  <div className={cx.infoNote}>
    <Lock size={15} className="mt-0.5 shrink-0" />
    <span>This project is read-only for your account. You can view walls, warnings and the order, and copy, print or export -- editing, linking and saving are turned off.</span>
  </div>
);

// Convenience for spreading onto a mutating control -- `{...useReadOnlyDisabled(readOnly)}`.
export function useReadOnlyDisabled(readOnly: boolean): { disabled: boolean } {
  return { disabled: readOnly };
}
