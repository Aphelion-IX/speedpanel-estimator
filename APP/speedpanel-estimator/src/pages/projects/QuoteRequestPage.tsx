// =============================================================================
// Request a Quote
// =============================================================================
// Public, anonymous submission form (no sign-in) that writes to the requests
// table via src/lib/requestsClient.ts's submitRequest. submitRequest already
// returns a user-facing error string when Supabase isn't configured, so the
// form itself doesn't need to pre-check that -- it just surfaces whatever
// error comes back on submit. The "attach my project" checkbox reads
// wallStore.ts's device-local PersistedProject once on mount via
// loadProject() and, if checked, sends it as-is in project_snapshot. This
// used to live at the "Projects" tab/route -- that's now the saved-projects
// feature (see ../projects/), so this moved to its own "Request a Quote" tab.
// A project's detail page can still reach this: "Request a quote" there
// stages that project's data into the same device-local PROJECT_KEY slot
// before navigating here, so this form's loadProject() call picks it up
// unmodified -- see ProjectDetailPage.tsx.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE } from "../../styleTokens";
import { submitRequest } from "../../lib/requestsClient";
import { loadProject, type PersistedProject } from "../../wallStore";
import { Field, TextAreaField } from "../shared/fields";

export const QuoteRequestPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [attach, setAttach] = useState(false);
  const [snapshot] = useState<PersistedProject | null>(() => loadProject());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div className={`${cx.infoNote} mt-6`}>
        <div>
          <p>Thanks -- we've received your request and will be in touch shortly.</p>
          <button onClick={() => { setSuccess(false); setName(""); setEmail(""); setPhone(""); setMessage(""); setAttach(false); }}
            className="mt-2 font-bold underline">Submit another request</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await submitRequest({
      name, email, phone: phone || undefined, message: message || undefined,
      projectSnapshot: attach ? snapshot : undefined,
    });
    setSubmitting(false);
    if (err) setError(err);
    else setSuccess(true);
  };

  return (
    <div className={`${cx.card} mt-6 max-w-sm`}>
      <h1 className="text-lg font-bold" style={{ color: NAVY }}>Request a Quote</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Email" value={email} onChange={setEmail} type="email" required autoComplete="email" />
        <Field label="Phone (optional)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
        <TextAreaField label="Message (optional)" value={message} onChange={setMessage} />

        <div>
          <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
            <input type="checkbox" checked={attach} disabled={!snapshot} onChange={e => setAttach(e.target.checked)} />
            Attach my current project
          </label>
          <p className={cx.footnote}>
            {snapshot
              ? "We'll include your current wall list and settings so we can quote faster."
              : "No current project found on this device -- start an estimate to attach one."}
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={submitting}
          className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {submitting ? "Sending..." : "Send request"}
        </button>
      </form>
    </div>
  );
};
