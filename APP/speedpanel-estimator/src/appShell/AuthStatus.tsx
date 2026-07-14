// =============================================================================
// Auth status
// =============================================================================
// Persistent sign-in/sign-out control shown in the header on every tab (see
// App.tsx's `right` prop to TopNav). Signed out: same icon-only button as
// before, handing off to the LandingPage's sign-in form (no session to show
// yet, so nothing to build a menu around). Signed in: an avatar/email/role
// trigger opening a small dropdown (Sign out, plus an Admin shortcut for
// staff) -- this is the one dropdown/menu primitive in the codebase, kept
// local to this component rather than a shared primitive since nothing else
// needs one yet.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, ChevronDown, ShieldCheck } from "lucide-react";
import { BLUE, WHITE, NAVY } from "../styleTokens";
import { IconButton } from "../ui/primitives";
import type { UseAuth } from "../lib/useAuth";
import { nameFromEmail, initialsFromEmail } from "../lib/emailDisplay";
import type { InternalRole } from "../pages/company/staffTypes";
import { INTERNAL_ROLE_LABELS } from "../pages/company/staffTypes";
import type { Route } from "./useHashRoute";

export const AuthStatus = ({ auth, onSignInClick, isInternalStaff, staffRole, navigate }: {
  auth: UseAuth;
  onSignInClick: () => void;
  isInternalStaff: boolean;
  staffRole: InternalRole | null;
  navigate: (route: Route) => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (auth.loading) return null;

  // Coloured (BLUE fill) only once actually signed in -- a neutral outline
  // button beforehand, so the fill reads as "you're logged in", not as a
  // generic call-to-action.
  if (!auth.session) {
    return (
      <IconButton onClick={onSignInClick} title="Log in">
        <LogIn size={16} />
      </IconButton>
    );
  }

  const email = auth.user?.email ?? "";
  const name = nameFromEmail(email);
  const initials = initialsFromEmail(email);
  const roleLabel = isInternalStaff && staffRole ? INTERNAL_ROLE_LABELS[staffRole] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title={`Signed in as ${email}`}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ background: BLUE, color: WHITE }}
        >
          {initials}
        </span>
        <span className="hidden text-left lg:block">
          <span className="block max-w-[130px] truncate text-sm font-semibold" style={{ color: NAVY }}>{name}</span>
          {roleLabel && <span className="block text-xs text-slate-400 dark:text-slate-500">{roleLabel}</span>}
        </span>
        <ChevronDown size={14} className="hidden shrink-0 text-slate-400 sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
          {isInternalStaff && (
            <button
              onClick={() => { setOpen(false); navigate({ tab: "admin", sub: "dashboard" }); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
              style={{ color: NAVY }}
            >
              <ShieldCheck size={15} /> Admin
            </button>
          )}
          <button
            onClick={() => { setOpen(false); auth.signOut(); }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-slate-50 dark:text-red-400 dark:hover:bg-slate-700"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};
