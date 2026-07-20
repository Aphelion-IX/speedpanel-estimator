// =============================================================================
// Read-only gate
// =============================================================================
// Spec §13's "Read-only access" for a saved project: may view walls/results/
// warnings, copy/print/export, but may not change data, links, or save.
// Genuinely calculator-agnostic (no fork-not-share concern), so this lives
// in src/ui/ and is shared by both calculators.
//
// No edit-vs-view permission concept exists anywhere in the app yet --
// ProjectDetailPage.tsx has no such gate today, and it's unconfirmed whether
// company-membership `role` values distinguish a non-edit tier. Real
// enforcement is RLS's job regardless (a write fails server-side if
// unauthorized, per CLAUDE.md); this is the UX layer, wired to a flag
// (App.tsx's readOnlyProject) that is always `false` today so behaviour is
// unchanged until a real permission signal exists to set it -- see App.tsx's
// own comment at that state's declaration.
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
