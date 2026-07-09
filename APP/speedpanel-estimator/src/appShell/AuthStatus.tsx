// =============================================================================
// Auth status
// =============================================================================
// Persistent sign-in/sign-out control shown in the header on every tab (see
// App.tsx's `right` prop to TopNav), so signing in isn't only reachable from
// inside the Projects tab's SignInGate. Signed out: a single icon button that
// hands off to SignInGate (no modal/dropdown primitive exists anywhere in
// this codebase, so reuse that page rather than duplicating a form here).
// Signed in: the same-size icon button (sign out) with a small green dot
// badge overlaid -- same absolute-positioned-dot convention wallsCard.tsx
// already uses for its per-wall warning indicator -- so the "you're logged
// in" indicator adds zero extra width to the header at any viewport (a
// separate text pill for the email crowded out the nav tabs down to ~1230px
// of usable content width, i.e. any laptop-class screen); the email is still
// available via the title tooltip. Matches headerToggles.tsx's plain
// icon-button convention (h-10 w-10, rounded-xl, border, shadow-sm).
// =============================================================================
import { LogIn, LogOut } from "lucide-react";
import type { UseAuth } from "../lib/useAuth";

export const AuthStatus = ({ auth, onSignInClick }: { auth: UseAuth; onSignInClick: () => void }) => {
  if (auth.loading) return null;

  if (!auth.session) {
    return (
      <button
        onClick={onSignInClick}
        title="Sign in"
        className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
      >
        <LogIn size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={() => auth.signOut()}
      title={auth.user?.email ? `Signed in as ${auth.user.email} -- click to sign out` : "Sign out"}
      className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm active:scale-95 transition-all"
    >
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-800 bg-emerald-500" />
      <LogOut size={16} />
    </button>
  );
};
