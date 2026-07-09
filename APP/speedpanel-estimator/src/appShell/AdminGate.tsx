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
//
// RoleSchema mirrors the profiles table's own `role in ('user','admin')`
// check constraint -- an unexpected value (or a failed/empty read) already
// falls back to "user" below, same as before, so this closes the gap without
// changing that fail-safe behavior.
// =============================================================================
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "../lib/supabaseClient";
import { cx, MUTED } from "../styleTokens";

const RoleSchema = z.enum(["user", "admin"]);
type Role = z.infer<typeof RoleSchema>;

export const AdminGate = ({ user, children }: { user: User | null; children: React.ReactNode }) => {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    supabase.from("profiles").select("role").eq("id", user.id).single().then(({ data }) => {
      if (cancelled) return;
      const parsed = RoleSchema.safeParse(data?.role);
      setRole(parsed.success ? parsed.data : "user");
      setLoading(false);
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
