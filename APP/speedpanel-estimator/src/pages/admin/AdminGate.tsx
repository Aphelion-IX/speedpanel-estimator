// =============================================================================
// Admin auth gate
// =============================================================================
// Wraps the whole #/admin/* render tree (see App.tsx). Fails closed: with
// Supabase unconfigured, signed out, or signed in without the admin role, no
// admin content (including Products) renders -- only the matching message.
// =============================================================================
import type { ReactNode } from "react";
import { cx, NAVY, BLUE, MUTED } from "../../styleTokens";
import { useAuth, signOutUser } from "../../lib/useAuth";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { AdminLoginForm } from "./AdminLoginForm";

const SignedInBar = ({ email }: { email: string }) => (
  <div className="mb-3 flex items-center justify-between gap-2 text-sm">
    <span style={{ color: MUTED }}>Signed in as <span className="font-semibold" style={{ color: NAVY }}>{email}</span></span>
    <button onClick={() => signOutUser()} className="font-bold" style={{ color: BLUE }}>Sign out</button>
  </div>
);

export const AdminGate = ({ children }: { children: ReactNode }) => {
  const { loading, userEmail, isAdmin } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <div className={`${cx.card} mt-6`}>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Admin sign-in unavailable</h1>
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          Supabase auth isn't configured for this environment. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable admin sign-in.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;
  }

  if (!userEmail) {
    return <AdminLoginForm />;
  }

  if (!isAdmin) {
    return (
      <div className="mt-6">
        <SignedInBar email={userEmail} />
        <div className={cx.card}>
          <p className="text-sm" style={{ color: NAVY }}>You do not have admin access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <SignedInBar email={userEmail} />
      {children}
    </div>
  );
};
