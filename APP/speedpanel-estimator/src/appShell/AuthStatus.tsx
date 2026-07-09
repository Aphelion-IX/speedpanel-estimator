// =============================================================================
// Auth status
// =============================================================================
// Persistent sign-in/sign-out control shown in the header on every tab (see
// App.tsx's `right` prop to TopNav), so signing in isn't only reachable from
// inside the Projects tab's SignInGate. Icon-only, same h-10 w-10 square
// button shape as the layout/theme toggles in headerToggles.tsx -- the title
// tooltip carries the "Log in"/"Signed in as ..." meaning. Signed out: hands
// off to SignInGate (no modal/dropdown primitive exists anywhere in this
// codebase, so reuse that page rather than duplicating a form here).
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
        className="grid h-10 w-10 place-items-center rounded-xl shadow-sm active:scale-95 transition-all"
        style={{ background: BLUE, color: WHITE }}
      >
        <LogIn size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={() => auth.signOut()}
      title={auth.user?.email ? `Signed in as ${auth.user.email} -- click to log out` : "Log out"}
      className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm active:scale-95 transition-all"
    >
      <LogOut size={16} />
    </button>
  );
};
