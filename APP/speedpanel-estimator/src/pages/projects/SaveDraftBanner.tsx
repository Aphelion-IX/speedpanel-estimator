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
import { NAVY, cx } from "../../styleTokens";
import { Button } from "../../ui/button";

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
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-900/55 px-4 py-3">
      <span className="text-sm font-semibold" style={{ color: NAVY }}>Working on an unsaved draft</span>
      {naming ? (
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" required autoFocus
            className={cx.input + " w-48 !py-2"} style={{ color: NAVY }} />
          {error && <span className="text-sm text-red-600 dark:text-red-300">{error}</span>}
          <Button type="submit" disabled={saving || !name.trim()}>{saving ? "Saving..." : "Save"}</Button>
          <Button type="button" variant="ghost" onClick={() => { setNaming(false); setError(null); }}>Cancel</Button>
        </form>
      ) : (
        <Button onClick={() => setNaming(true)}>Save as Project</Button>
      )}
    </div>
  );
};
