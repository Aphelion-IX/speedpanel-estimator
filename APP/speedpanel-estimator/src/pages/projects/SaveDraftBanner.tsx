// =============================================================================
// Estimator tab -- "Save as Project" banner
// =============================================================================
// The counterpart to App.tsx's "Editing project: ..." banner (only one of the
// two is ever visible -- see App.tsx's !openProject render gate) -- gives a
// user who lands on the Estimator tab directly (it's the default route) a way
// to turn the current device-local draft into a real saved project, matching
// the naming-form pattern WallSystemOptionCard.tsx already established for
// System Selector's "Select System" flow.
// =============================================================================
import { useState } from "react";
import { NAVY, BLUE, MUTED, cx } from "../../styleTokens";

export const SaveDraftBanner = ({ onSave }: { onSave: (name: string) => Promise<string | null> }) => {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const err = await onSave(name.trim());
    setSaving(false);
    if (err) setError(err);
    // On success the parent opens the newly created project, which unmounts
    // this banner in favour of the "Editing project: ..." one -- no local
    // success state to reset back to here.
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 px-4 py-3">
      <span className="text-sm font-semibold" style={{ color: NAVY }}>Working on an unsaved draft</span>
      {naming ? (
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" required autoFocus
            className={cx.input + " w-48 !py-2"} style={{ color: NAVY }} />
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          <button type="submit" disabled={saving || !name.trim()}
            className="rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: "#fff" }}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => { setNaming(false); setError(null); }}
            className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ color: MUTED }}>
            Cancel
          </button>
        </form>
      ) : (
        <button onClick={() => setNaming(true)}
          className="rounded-xl px-4 py-2 text-sm font-bold" style={{ background: BLUE, color: "#fff" }}>
          Save as Project
        </button>
      )}
    </div>
  );
};
