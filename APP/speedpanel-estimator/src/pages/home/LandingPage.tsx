// =============================================================================
// Landing page -- signed-out front door ("mySPEEDPORTAL" design)
// =============================================================================
// Full-bleed standalone page (App.tsx renders this via an early return
// before the normal TopNav/shell wrapper, the same way it already does for
// the printable proforma page) -- no top nav, this IS the whole screen.
// Ported from an uploaded SpeedHubLoginPage.tsx mockup and wired to real
// auth: the mockup's local onSubmit prop becomes a real auth.signIn() call
// with submitting/error state (same convention as the old SignInGate.tsx),
// and its sign-up toggle is dropped entirely -- this app no longer offers
// self-service sign-up from the front door; new accounts come from a staff
// admin invite instead. "Forgot password" has no real reset flow yet (no
// resetPassword method on useAuth.ts) so it's a stub note, not a live
// action. "Remember me" is decorative only -- it doesn't change Supabase's
// session persistence, there's no wiring behind it yet.
// =============================================================================
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound, Zap, BarChart3, FileText } from "lucide-react";
import { BLUE, MUTED } from "../../styleTokens";
import type { UseAuth } from "../../lib/useAuth";

const FEATURES = [
  { icon: Zap, title: "Estimate and quote faster", description: "Create accurate project estimates with guided system selection." },
  { icon: BarChart3, title: "Track projects from order to delivery", description: "See milestones, orders and delivery status in one place." },
  { icon: FileText, title: "Access technical documents and support", description: "Find drawings, certificates, warranties and project services." },
];

export const LandingPage = ({ auth, pendingNote }: { auth: UseAuth; pendingNote?: string }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPasswordClicked, setForgotPasswordClicked] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await auth.signIn(email, password);
    setSubmitting(false);
    if (err) setError(err);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f9fc] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      {/* Blueprint grid -- graph-paper base texture */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,117,204,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,117,204,0.06)_1px,transparent_1px)] bg-[size:48px_48px] dark:bg-[linear-gradient(rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.08)_1px,transparent_1px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,117,204,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,117,204,0.025)_1px,transparent_1px)] bg-[size:12px_12px] dark:bg-[linear-gradient(rgba(59,130,246,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.04)_1px,transparent_1px)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1.25fr_0.75fr]">
        {/* Brand panel -- marketing copy, hidden on phone widths so the login
            card is the whole screen instead of something to scroll past */}
        <section className="hidden min-w-0 items-center px-6 py-12 sm:flex sm:px-10 lg:px-16 xl:px-20">
          <div className="min-w-0 max-w-2xl">
            <div>
              <div className="flex flex-wrap items-baseline">
                <span className="text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">my</span>
                <span className="text-4xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl" style={{ color: BLUE }}>SPEEDPORTAL</span>
              </div>
              <p className="mt-2 text-xl font-semibold tracking-wide text-slate-500 dark:text-slate-300 sm:text-2xl">by SPEEDPANEL</p>
            </div>

            <h1 className="mt-12 max-w-xl text-3xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              Everything you need to plan, order and manage your SPEEDPANEL projects.
            </h1>

            <div className="mt-10 space-y-5">
              {FEATURES.map(f => <Feature key={f.title} {...f} />)}
            </div>
          </div>
        </section>

        {/* Login panel */}
        <section className="flex min-w-0 items-center justify-center px-6 py-12 sm:px-10 lg:px-12">
          <div className="w-full min-w-0 max-w-xl">
            <div className="rounded-[28px] border border-white/80 bg-white/95 p-7 pb-9 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 sm:p-10 sm:pb-12">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: BLUE }}>Welcome back</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Log in to mySPEEDPORTAL</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Access your projects, estimates, orders and documents.</p>
                {pendingNote && <p className="mt-2 text-sm" style={{ color: MUTED }}>{pendingNote}</p>}
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Email</label>
                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-blue-950/40">
                    <UserRound className="h-5 w-5 text-slate-400" />
                    <input
                      id="email" type="email" autoComplete="email" required
                      value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="ml-3 h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Password</label>
                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-4 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:focus-within:ring-blue-950/40">
                    <LockKeyhole className="h-5 w-5 text-slate-400" />
                    <input
                      id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="ml-3 h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                    />
                    <button
                      type="button" onClick={() => setShowPassword(v => !v)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>

                  <button
                    type="button" onClick={() => setForgotPasswordClicked(true)}
                    className="text-sm font-semibold hover:opacity-80" style={{ color: BLUE }}
                  >
                    Forgot password?
                  </button>
                </div>
                {forgotPasswordClicked && (
                  <p className="text-sm" style={{ color: MUTED }}>Contact your SPEEDPANEL representative to reset your password.</p>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

                <button
                  type="submit" disabled={submitting}
                  className="flex h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-950/40 disabled:opacity-50"
                  style={{ background: BLUE }}
                >
                  {submitting ? "Please wait..." : "Log in"}
                </button>
              </form>

              <div className="mt-8 mb-5 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-400">Need access?</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              <p className="w-full text-center text-sm text-slate-500 dark:text-slate-300">
                Contact your <span className="font-semibold" style={{ color: BLUE }}>SPEEDPANEL representative</span>
              </p>
            </div>

            <footer className="mt-6 flex flex-col items-center justify-between gap-3 px-2 text-xs text-slate-500 dark:text-slate-400 sm:flex-row">
              <span>&copy; {new Date().getFullYear()} SPEEDPANEL. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <button className="hover:text-slate-800 dark:hover:text-slate-300">Privacy Policy</button>
                <button className="hover:text-slate-800 dark:hover:text-slate-300">Terms of Service</button>
              </div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
};

function Feature({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-blue-100 bg-white/80 shadow-sm backdrop-blur dark:border-blue-800/60 dark:bg-slate-900/60" style={{ color: BLUE }}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-300">{description}</p>
      </div>
    </div>
  );
}
