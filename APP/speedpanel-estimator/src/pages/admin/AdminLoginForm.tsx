// =============================================================================
// Admin sign-in form
// =============================================================================
// Email/password only -- internal admin gate, not a public customer login (no
// magic link, no self-signup). Reuses the same input/label/card primitives as
// the rest of the admin section (see productDetailPanel.tsx's Field).
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE } from "../../styleTokens";
import { signIn } from "../../lib/useAuth";

export const AdminLoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await signIn(email, password);
    setSubmitting(false);
    if (err) setError(err);
    // On success, useAuth's onAuthStateChange listener re-renders AdminGate --
    // no redirect/navigation needed here.
  };

  return (
    <div className={`${cx.card} mt-6 max-w-sm`}>
      <h1 className="text-lg font-bold" style={{ color: NAVY }}>Admin sign-in</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className={cx.lbl}>Email</label>
          <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}
            className={cx.input} style={{ color: NAVY }} />
        </div>
        <div>
          <label className={cx.lbl}>Password</label>
          <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
            className={cx.input} style={{ color: NAVY }} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};
