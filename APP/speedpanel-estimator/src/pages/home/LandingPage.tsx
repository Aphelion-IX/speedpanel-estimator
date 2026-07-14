// =============================================================================
// Landing page -- signed-out front door
// =============================================================================
// Shown at "/" (the home route's default, see useHashRoute.ts) whenever
// there's no session. A short welcome, then the existing SignInGate.tsx
// unchanged underneath -- same component ProjectsRouter.tsx already uses
// for its own signed-out fallback, so sign-in/sign-up/anonymous-quote logic
// isn't duplicated. Deliberately minimal, not a marketing page -- a visitor
// who wants to use the Estimator/System Selector/Education Hub without
// signing in already can, directly via the always-visible top nav.
// =============================================================================
import { NAVY, MUTED } from "../../styleTokens";
import { SignInGate } from "../projects/SignInGate";
import type { UseAuth } from "../../lib/useAuth";

export const LandingPage = ({ auth, onRequestQuote, pendingNote }: {
  auth: UseAuth; onRequestQuote: () => void; pendingNote?: string;
}) => (
  <div className="mt-6">
    <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: NAVY }}>Welcome to Speedpanel Estimator</h1>
    <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: MUTED }}>
      Sign in to save projects, request quotes, and track orders.
    </p>
    <SignInGate auth={auth} onRequestQuote={onRequestQuote} pendingNote={pendingNote} />
  </div>
);
