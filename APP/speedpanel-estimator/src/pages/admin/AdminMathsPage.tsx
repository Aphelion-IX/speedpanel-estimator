// =============================================================================
// Admin > Maths -- editable estimate calculation constants
// =============================================================================
// Unlike Products/Systems/Documents/Requests (all decoupled preview-only
// staging areas), edits here are meant to actually change calculator output.
// data.ts reads these constants once at module load (loadMathConstants()),
// so the only way for an edit to take effect is to persist it and reload the
// page -- there's no React state/context threaded through the pure
// calculation functions in src/estimate/* for this to update live otherwise.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { NumField, NumberListField } from "../shared/fields";
import { MATH_CONSTANT_DEFAULTS, MATH_CONSTANT_FIELDS, type MathConstants } from "../../mathConstants";
import { useMathConstantsStore } from "./maths/mathConstantsStore";

const GROUP_LABEL: Record<"internal" | "external", string> = { internal: "Internal system constants", external: "External system constants" };

export const AdminMathsPage = () => {
  const mathStore = useMathConstantsStore();
  const [draft, setDraft] = useState<MathConstants>(mathStore.draft);
  const touched = useRef(false);

  // mathStore.draft starts from the synchronous localStorage read (identical
  // to today), then may update once the background Supabase fetch resolves
  // to a different cross-device value -- mirror that into the editable
  // draft, but only until the admin starts typing (`touched`), so an
  // in-progress edit is never silently overwritten by a slower network
  // response landing after the admin has already started changing values.
  useEffect(() => { if (!touched.current) setDraft(mathStore.draft); }, [mathStore.draft]);

  const set = <K extends keyof MathConstants>(key: K, value: MathConstants[K]) => {
    touched.current = true;
    setDraft(d => ({ ...d, [key]: value }));
  };

  const save = async () => {
    const err = await mathStore.save(draft);
    if (err) { window.alert(err); return; }
    window.location.reload();
  };
  const cancel = () => { touched.current = false; setDraft(mathStore.draft); };
  const resetToDefaults = async () => {
    const err = await mathStore.save(MATH_CONSTANT_DEFAULTS);
    if (err) { window.alert(err); return; }
    window.location.reload();
  };

  return (
    <div className="mt-2">
      <span className={`${cx.badge} inline-block bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400`}>
        Saving applies these values to every estimate and reloads the app
      </span>
      {mathStore.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{mathStore.error} (showing this device's last-saved values)</p>}
      {mathStore.loading && <p className="mt-2 text-xs" style={{ color: MUTED }}>Loading latest saved values...</p>}

      {(["internal", "external"] as const).map(group => (
        <div key={group} className={`${cx.card} mt-4`}>
          <div className={cx.cardHd}>{GROUP_LABEL[group]}</div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MATH_CONSTANT_FIELDS.filter(f => f.group === group).map(f => (
              <div key={f.key}>
                {f.kind === "number" ? (
                  <NumField
                    label={f.label}
                    value={draft[f.key] as number}
                    onChange={v => set(f.key, v as MathConstants[typeof f.key])}
                  />
                ) : (
                  <NumberListField
                    label={f.label}
                    value={draft[f.key] as number[]}
                    onChange={v => set(f.key, v as MathConstants[typeof f.key])}
                  />
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.helpText}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={save} className="rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm active:scale-95 transition-all" style={{ background: BLUE, color: WHITE }}>
          Save &amp; reload
        </button>
        <button onClick={cancel} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold active:scale-95 transition-all" style={{ color: NAVY }}>
          Cancel
        </button>
        <button onClick={resetToDefaults} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 active:scale-95 transition-all">
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
