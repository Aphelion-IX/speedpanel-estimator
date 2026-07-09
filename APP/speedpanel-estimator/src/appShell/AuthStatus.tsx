// =============================================================================
// Auth status
// =============================================================================
// Persistent sign-in/sign-out control shown in the header on every tab (see
// App.tsx's `right` prop to TopNav), so signing in isn't only reachable from
// inside the Projects tab's SignInGate. Labeled (not icon-only) so it reads
// unambiguously as the login control next to the plain icon toggles in
// headerToggles.tsx -- an icon-only button here was easy to miss/mistake for
// another toggle. Signed out: hands off to SignInGate (no modal/dropdown
// primitive exists anywhere in this codebase, so reuse that page rather than
// duplicating a form here).
// =============================================================================
import { LogIn, LogOut } from "lucide-react";
import { BLUE, WHITE } from "../styleTokens";
import type { UseAuth } from "../lib/useAuth";

export const AuthStatus = ({ auth, onSignInClick }: { auth: UseAuth; onSignInClick: () => void }) => {
  if (auth.loading) return null;

  if (!auth.session) {
    return (
      <button
        onClick={onSignInClick}
        title="Log in"
        className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-bold shadow-sm active:scale-95 transition-all"
        style={{ background: BLUE, color: WHITE }}
      >
        <LogIn size={16} />
        Log in
      </button>
    );
  }

  return (
    <button
      onClick={() => auth.signOut()}
      title={auth.user?.email ? `Signed in as ${auth.user.email}` : undefined}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 shadow-sm active:scale-95 transition-all"
    >
      <LogOut size={16} />
      Log out
    </button>
  );
};
