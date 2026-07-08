// =============================================================================
// useAuth
// =============================================================================
// Minimal email+password auth over Supabase Auth. Called once in App.tsx
// (alongside useLayoutMode/useThemeMode) and threaded down as a prop, same
// convention as those hooks. Every method returns Promise<string | null>
// (null = success, string = user-facing error) -- same shape as
// requestsClient.ts's submitRequest and requestsStore.ts's updateStatus, so
// callers don't need a try/catch. Guards on !supabase first everywhere,
// matching supabaseClient.ts's "importing/using this is always safe" rule.
// =============================================================================
import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

const NOT_CONFIGURED = "Sign-in isn't configured for this environment.";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(() =>
    supabase ? { session: null, user: null, loading: true } : { session: null, user: null, loading: false },
  );

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async (): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  }, []);

  return { ...state, signUp, signIn, signOut };
}

export type UseAuth = ReturnType<typeof useAuth>;
