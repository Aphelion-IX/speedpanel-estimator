// =============================================================================
// Admin auth -- email/password sign-in + role lookup
// =============================================================================
// Consumed by AdminGate.tsx to gate #/admin/*. Every function here is safe to
// call whether or not Supabase is configured (see supabaseClient.ts) -- signIn
// returns an error string instead of throwing, and useAuth resolves to the
// signed-out state immediately when `supabase` is null.
// =============================================================================
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type AdminRole = "user" | "admin";

export interface AuthState {
  loading: boolean;
  userEmail: string | null;
  role: AdminRole | null;
  isAdmin: boolean;
}

const SIGNED_OUT: AuthState = { loading: false, userEmail: null, role: null, isAdmin: false };

async function loadRole(userId: string): Promise<AdminRole | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as AdminRole | undefined) ?? null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => (supabase ? { ...SIGNED_OUT, loading: true } : SIGNED_OUT));

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    const client = supabase;

    const applySession = async (userId: string | undefined, email: string | null | undefined) => {
      if (!userId) {
        if (!cancelled) setState(SIGNED_OUT);
        return;
      }
      const role = await loadRole(userId);
      if (!cancelled) setState({ loading: false, userEmail: email ?? null, role, isAdmin: role === "admin" });
    };

    client.auth.getSession().then(({ data }) => applySession(data.session?.user.id, data.session?.user.email));

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user.id, session?.user.email);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase is not configured.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signOutUser(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}
