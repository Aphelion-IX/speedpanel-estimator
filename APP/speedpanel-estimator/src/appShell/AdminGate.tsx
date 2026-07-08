// =============================================================================
// Admin gate
// =============================================================================
// The Admin section previously had no sign-in gate at all (see the comment in
// requestsStore.ts) -- RLS on the requests/projects tables was the only thing
// standing between an anonymous visitor and admin-only data, since nothing
// ever checked profiles.role client-side. This wraps the admin route block in
// App.tsx with a role check, using the same profiles table/role convention
// documented in supabase/schema.sql. Not a security boundary by itself (RLS
// is) -- purely a UX gate so a non-admin sees a message instead of a
// permanently-empty/erroring admin page.
// =============================================================================
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import { cx, MUTED } from "../styleTokens";

type Role = "user" | "admin";

export const AdminGate = ({ user, children }: { user: User | null; children: React.ReactNode }) => {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
      if (!cancelled) { setRole((data?.role as Role) ?? "user"); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>Loading...</div>;

  if (role !== "admin") {
    return (
      <div className={`${cx.card} mt-6 text-sm`} style={{ color: MUTED }}>
        {user ? "You don't have access to this section." : "Sign in with an admin account to view this section."}
      </div>
    );
  }

  return <>{children}</>;
};
