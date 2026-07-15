// =============================================================================
// Sign-in gate
// =============================================================================
// Shown in place of the projects list/detail whenever there's no session --
// a plain page (not a modal), toggling between sign-in and sign-up via local
// state. Built from the same Field/card/button conventions as
// QuoteRequestPage.tsx's form -- no shared <Button> exists anywhere in this
// codebase, so the submit button is hand-rolled the same way that form's is.
// Also the discoverability entry point for the anonymous "Request a Quote"
// flow now that it's nested under Projects instead of its own top-nav tab --
// onRequestQuote below routes to it without requiring a session. pendingNote
// explains a redirect the user didn't initiate themselves -- e.g. clicking
// "Select System" in the System Selector while signed out (see App.tsx's
// createProjectFromSystem/pendingSystemSelection).
// =============================================================================
import { useState } from "react";
import { cx, BLUE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { Button } from "../../ui/button";
import type { UseAuth } from "../../lib/useAuth";

export const SignInGate = ({ auth, onRequestQuote, pendingNote }: { auth: UseAuth; onRequestQuote: () => void; pendingNote?: string }) => {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = mode === "signIn" ? await auth.signIn(email, password) : await auth.signUp(email, password);
    setSubmitting(false);
    if (err) { setError(err); return; }
    if (mode === "signUp") setSignedUp(true);
  };

  if (signedUp) {
    return (
      <div className={`${cx.infoNote} mt-6`}>
        <div>
          <p>Account created -- check your email to confirm it, then sign in below.</p>
          <button onClick={() => { setSignedUp(false); setMode("signIn"); }} className="mt-2 font-bold underline">Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${cx.card} mt-6 max-w-sm`}>
      <h1 className={cx.h2}>{mode === "signIn" ? "Sign in" : "Create an account"}</h1>
      <p className={cx.footnote} style={{ paddingTop: 0 }}>Sign in to save and reopen your projects.</p>
      {pendingNote && <p className="mt-1 text-sm" style={{ color: MUTED }}>{pendingNote}</p>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" />
        <Field label="Password" value={password} onChange={setPassword} type="password" required
          autoComplete={mode === "signIn" ? "current-password" : "new-password"} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Please wait..." : mode === "signIn" ? "Sign in" : "Sign up"}
        </Button>
      </form>
      <button onClick={() => { setMode(m => m === "signIn" ? "signUp" : "signIn"); setError(null); }}
        className="mt-3 text-sm font-semibold hover:underline" style={{ color: BLUE }}>
        {mode === "signIn" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
      <button onClick={onRequestQuote} className="mt-3 block text-sm font-semibold hover:underline" style={{ color: BLUE }}>
        Just want a quote? Request one without an account &rarr;
      </button>
    </div>
  );
};
