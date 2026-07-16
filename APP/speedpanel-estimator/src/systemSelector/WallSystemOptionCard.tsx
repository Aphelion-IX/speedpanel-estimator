// =============================================================================
// System Selector -- option card
// =============================================================================
// "Select System" creates a saved project pre-set to this card's system/
// wallSystem (see App.tsx's createProjectFromSystem) -- but only for cards
// with a real `option.system` mapping. Descriptive-only cards (Separation,
// Cinema, Stair, ...) have no system to seed a project with, so they keep
// the old inert button (see systemOptions.ts's own comment on why those are
// left unmapped).
// =============================================================================
import { useState } from "react";
import { Check } from "lucide-react";
import { NAVY, BLUE, WHITE, MUTED, cx } from "../styleTokens";
import { Field } from "../pages/shared/fields";
import type { WallSystemOption } from "./systemOptions";

export const WallSystemOptionCard = ({ option, selected, onCreateProject }: {
  option: WallSystemOption; selected: boolean; onCreateProject: (name: string) => Promise<string | null>;
}) => {
  const Icon = option.icon;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const err = await onCreateProject(name.trim());
    setCreating(false);
    if (err) setError(err);
    // On success the parent navigates away (Estimator or sign-in) -- no
    // local success state to reset back to here.
  };

  return (
    <div className={"mt-3 " + cx.card + " h-full flex flex-col gap-3"} style={selected ? { borderColor: BLUE, borderWidth: 2 } : undefined}>
      <div className="relative">
        <div className="h-20 rounded-lg grid place-items-center border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <Icon size={28} style={{ color: BLUE }} />
        </div>
        {selected && (
          <div className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full shadow-sm" style={{ background: BLUE }}>
            <Check size={14} color={WHITE} strokeWidth={3} />
          </div>
        )}
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: NAVY }}>{option.title}</div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{option.description}</p>
      </div>
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <p className={cx.footnote + " pt-0"}>{option.note}</p>
      </div>
      {/* mt-auto pins the CTA to the bottom regardless of how tall the title/
          description/note above it are -- keeps every card's button aligned
          on the same row once the grid stretches all cards to equal height. */}
      {selected ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
          <Check size={14} /> Selected
        </div>
      ) : naming ? (
        <form onSubmit={handleCreate} className="mt-auto space-y-2">
          <Field label="Project name" value={name} onChange={setName} required />
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !name.trim()}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
              {creating ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={() => { setNaming(false); setError(null); }}
              className="rounded-xl px-3 text-sm font-semibold" style={{ color: MUTED }}>
              Cancel
            </button>
          </div>
        </form>
      ) : option.system !== undefined ? (
        <button onClick={() => setNaming(true)}
          className="mt-auto w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          Select System
        </button>
      ) : (
        // Descriptive-only card -- no system mapping to create a project with
        // (see systemOptions.ts), so this stays an inert stub.
        <button className="mt-auto w-full rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2.5 text-sm font-bold active:scale-95 transition-all" style={{ color: BLUE }}>
          Select System
        </button>
      )}
    </div>
  );
};
